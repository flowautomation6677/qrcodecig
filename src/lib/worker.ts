import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { prisma } from './prisma';
import { campaignQueue } from './queue';
import dotenv from 'dotenv';

// Carrega as variáveis de ambiente
dotenv.config({ path: '.env.local' });
dotenv.config();

const connection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null,
});

connection.on('error', (err) => {
  console.warn('[Worker Redis] Aviso de conexão com Redis:', err?.message);
});

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const parseSpintax = (text: string) => {
  if (!text) return '';
  let parsed = text;
  const regex = /\{([^{}]+)\}/g;
  let match;
  while ((match = regex.exec(parsed)) !== null) {
    const options = match[1].split('|');
    const randomOption = options[Math.floor(Math.random() * options.length)];
    parsed = parsed.replace(match[0], randomOption);
    regex.lastIndex = 0;
  }
  return parsed;
};

const injectVariables = (text: string, contact: any) => {
  if (!text) return '';
  let result = text;
  Object.keys(contact).forEach((key) => {
    const regex = new RegExp(String.raw`\{${key}\}`, 'gi');
    result = result.replace(regex, contact[key] || '');
  });
  return result;
};

// Envia diretamente para a Evolution API com zero dependência de portas ou HTTP loopback
async function sendToEvolutionAPI(payload: any) {
  const { action, number, message, instance, delay: pDelay, mediaType, mediaUrl, mediaBase64, fileName, caption, isPtt } = payload;
  const instanceName = instance || process.env.EVOLUTION_INSTANCE_NAME;
  const apiUrl = process.env.EVOLUTION_API_URL?.replace(/\/$/, '');
  const apiKey = process.env.EVOLUTION_API_KEY;

  if (apiUrl && apiKey && instanceName) {
    try {
      if (action === 'presence') {
        const presenceType = mediaType === 'audio' ? 'recording' : 'composing';
        const res = await fetch(`${apiUrl}/chat/sendPresence/${encodeURIComponent(instanceName)}`, {
          method: 'POST',
          headers: { apikey: apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ number, presence: presenceType, delay: pDelay || 5000 }),
        });
        return { ok: res.ok, status: res.status, json: async () => ({ success: true }) };
      }

      if (action === 'check') {
        const res = await fetch(`${apiUrl}/chat/whatsappNumbers/${encodeURIComponent(instanceName)}`, {
          method: 'POST',
          headers: { apikey: apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ numbers: [number] }),
        });
        if (!res.ok) return { ok: true, status: 200, json: async () => ({ exists: true }) };
        const data = await res.json();
        const exists = Array.isArray(data) && data.length > 0 ? data[0]?.exists : true;
        return { ok: true, status: 200, json: async () => ({ exists }) };
      }

      if (action === 'sendText') {
        const res = await fetch(`${apiUrl}/message/sendText/${encodeURIComponent(instanceName)}`, {
          method: 'POST',
          headers: { apikey: apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            number,
            text: message,
            options: { delay: 0, presence: 'composing', linkPreview: true },
            textMessage: { text: message },
          }),
        });
        const data = await res.json();
        return { ok: res.ok, status: res.status, json: async () => data };
      }

      if (action === 'sendMedia') {
        let mediaData = mediaBase64 || mediaUrl;
        if (mediaData && mediaData.startsWith('data:')) {
          mediaData = mediaData.substring(mediaData.indexOf(',') + 1);
        }
        const res = await fetch(`${apiUrl}/message/sendMedia/${encodeURIComponent(instanceName)}`, {
          method: 'POST',
          headers: { apikey: apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            number,
            mediatype: mediaType || 'image',
            media: mediaData,
            caption: caption || message || '',
            fileName: fileName || (mediaType === 'image' ? 'imagem.jpg' : 'arquivo'),
            options: { delay: 0, presence: 'composing' },
            mediaMessage: {
              mediatype: mediaType || 'image',
              caption: caption || message || '',
              media: mediaData,
              fileName: fileName || (mediaType === 'image' ? 'imagem.jpg' : 'arquivo'),
            },
          }),
        });
        const data = await res.json();
        return { ok: res.ok, status: res.status, json: async () => data };
      }

      if (action === 'sendAudio') {
        let audioData = mediaBase64 || mediaUrl;
        if (audioData && audioData.startsWith('data:')) {
          audioData = audioData.substring(audioData.indexOf(',') + 1);
        }
        const res = await fetch(`${apiUrl}/message/sendWhatsAppAudio/${encodeURIComponent(instanceName)}`, {
          method: 'POST',
          headers: { apikey: apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            number,
            audio: audioData,
            options: { delay: 0, presence: 'recording', encoding: true },
            audioMessage: { audio: audioData },
          }),
        });
        const data = await res.json();
        return { ok: res.ok, status: res.status, json: async () => data };
      }
    } catch (directErr: any) {
      console.warn('[Worker] Chamada direta falhou, tentando fallback HTTP local:', directErr?.message);
    }
  }

  // Fallback caso a chamada direta encontre erro
  const nextAppUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://127.0.0.1:3000';
  const response = await fetch(`${nextAppUrl}/api/whatsapp/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return response;
}

// Rastreia IDs de campanhas atualmente em processamento neste processo
const activeCampaignIds = new Set<string>();

export const worker = new Worker(
  'campaign-queue',
  async (job: Job) => {
    const campaignId = job.data?.campaignId;
    console.log(`[Worker] Iniciando processamento do job: ${job.id} - Campanha: ${campaignId}`);

    if (!campaignId) {
      console.error('[Worker] Job sem campaignId fornecido.');
      return;
    }

    activeCampaignIds.add(campaignId);

    try {
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        include: { contacts: { where: { status: 'pending' } } },
      });

      if (!campaign) {
        console.error(`[Worker] Campanha ${campaignId} não encontrada.`);
        return;
      }

      if (campaign.contacts.length === 0) {
        console.log(`[Worker] Campanha "${campaign.name}" (${campaign.id}) não tem contatos pendentes. Concluindo.`);
        await prisma.campaign.update({
          where: { id: campaign.id },
          data: { status: 'completed' },
        });
        return;
      }

      // Atualiza o status para running
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: 'running' },
      });

      const contacts = campaign.contacts;
      let sent = 0;
      let failed = 0;

      for (let i = 0; i < contacts.length; i++) {
        // Verifica se a campanha foi pausada ou parada externamente
        const currentCampaign = await prisma.campaign.findUnique({
          where: { id: campaign.id },
          select: { status: true },
        });

        if (currentCampaign?.status !== 'running') {
          console.log(`[Worker] Campanha ${campaign.id} interrompida. Status atual: ${currentCampaign?.status}`);
          break;
        }

        const contact = contacts[i];
        const targetNumber = String(contact.number).replace(/\D/g, '');
        const finalText = parseSpintax(injectVariables(campaign.messageTemplate, contact));

        console.log(`[Worker] Enviando para ${targetNumber} (${i + 1}/${contacts.length})...`);

        try {
          // 1. Validar (Check se existe no WhatsApp)
          const checkRes = await sendToEvolutionAPI({
            action: 'check',
            number: targetNumber,
            instance: campaign.instanceName,
          });
          const checkData = await checkRes.json().catch(() => ({ exists: true }));

          if (!checkData.exists && checkRes.ok) {
            await prisma.contact.update({
              where: { id: contact.id },
              data: { status: 'failed', error: 'Número não possui WhatsApp' },
            });
            failed++;
            continue;
          }

          // 2. Presence (Simula gravação ou digitação)
          const isAudio = campaign.messageMode === 'audio';
          const isVideo = campaign.messageMode === 'video';
          const typingDelay = isAudio ? 5000 : isVideo ? 8000 : Math.min(Math.max(finalText.length * 50, 3000), 12000);

          await sendToEvolutionAPI({
            action: 'presence',
            number: targetNumber,
            instance: campaign.instanceName,
            delay: typingDelay,
            mediaType: isAudio ? 'audio' : isVideo ? 'video' : 'text',
          });
          await delay(typingDelay);

          // 3. Enviar Mensagem
          let sendRes;
          if (campaign.messageMode === 'text') {
            sendRes = await sendToEvolutionAPI({
              action: 'sendText',
              number: targetNumber,
              message: finalText,
              instance: campaign.instanceName,
            });
          } else if (campaign.messageMode === 'image') {
            sendRes = await sendToEvolutionAPI({
              action: 'sendMedia',
              number: targetNumber,
              mediaType: 'image',
              mediaBase64: campaign.mediaBase64,
              mediaUrl: campaign.mediaUrl,
              fileName: campaign.fileName || 'imagem.jpg',
              caption: finalText,
              instance: campaign.instanceName,
            });
          } else if (campaign.messageMode === 'video') {
            sendRes = await sendToEvolutionAPI({
              action: 'sendMedia',
              number: targetNumber,
              mediaType: 'video',
              mediaBase64: campaign.mediaBase64,
              mediaUrl: campaign.mediaUrl,
              fileName: campaign.fileName || 'video.mp4',
              caption: finalText,
              instance: campaign.instanceName,
            });
          } else {
            sendRes = await sendToEvolutionAPI({
              action: 'sendAudio',
              number: targetNumber,
              mediaBase64: campaign.mediaBase64,
              mediaUrl: campaign.mediaUrl,
              fileName: campaign.fileName || 'audio.ogg',
              isPtt: campaign.isPtt,
              caption: finalText,
              instance: campaign.instanceName,
            });
          }

          if (sendRes.ok) {
            await prisma.contact.update({
              where: { id: contact.id },
              data: { status: 'sent', sentAt: new Date() },
            });
            sent++;
          } else {
            const err = await sendRes.json().catch(() => ({ error: 'Falha no envio' }));
            await prisma.contact.update({
              where: { id: contact.id },
              data: { status: 'failed', error: JSON.stringify(err) },
            });
            failed++;
          }
        } catch (e: any) {
          await prisma.contact.update({
            where: { id: contact.id },
            data: { status: 'failed', error: e.message },
          });
          failed++;
        }

        // 4. Cadência Anti-Ban
        if (i < contacts.length - 1) {
          const isBatchEnd = (i + 1) % campaign.batchSize === 0;
          if (isBatchEnd) {
            console.log(`[Worker] Pausa de lote: ${campaign.batchPause} min...`);
            await delay(campaign.batchPause * 60 * 1000);
          } else {
            const waitSeconds = Math.floor(Math.random() * (campaign.delayMax - campaign.delayMin + 1)) + campaign.delayMin;
            console.log(`[Worker] Aguardando ${waitSeconds}s (Anti-Ban)...`);
            await delay(waitSeconds * 1000);
          }
        }
      }

      // Finaliza a campanha se concluiu todos os contatos
      const updatedCampaign = await prisma.campaign.findUnique({ where: { id: campaign.id } });
      if (updatedCampaign?.status === 'running') {
        await prisma.campaign.update({
          where: { id: campaign.id },
          data: { status: 'completed' },
        });
        console.log(`[Worker] Campanha "${campaign.name}" (${campaign.id}) concluída com sucesso. Enviados: ${sent}, Falhas: ${failed}`);
      }
    } finally {
      activeCampaignIds.delete(campaignId);
    }
  },
  { connection }
);

worker.on('failed', (job: Job | undefined, err: Error) => {
  console.error(`[Worker] Job ${job?.id} falhou com erro: ${err.message}`);
});

worker.on('error', (err: Error) => {
  console.error(`[Worker] Erro no Worker BullMQ: ${err?.message}`);
});

console.log('[Worker] Worker iniciado e aguardando campanhas na fila "campaign-queue"...');

// Função de auto-recuperação de campanhas que ficaram pendentes ou interrompidas
async function recoverPendingCampaigns() {
  try {
    const unfinished = await prisma.campaign.findMany({
      where: {
        status: { in: ['pending', 'running', 'scheduled'] },
      },
      include: {
        contacts: {
          where: { status: 'pending' },
          take: 1,
        },
      },
    });

    if (unfinished.length === 0) return;

    // Busca jobs atualmente ativos ou em espera na fila do BullMQ
    const currentJobs = await campaignQueue.getJobs(['active', 'waiting', 'delayed']);
    const queuedCampaignIds = new Set(currentJobs.map((j) => j.data?.campaignId));

    for (const c of unfinished) {
      // Se não há contatos pendentes restantes, marca campanha como concluída
      if (!c.contacts || c.contacts.length === 0) {
        if (c.status !== 'completed') {
          console.log(`[Worker] Campanha "${c.name}" (ID: ${c.id}) sem contatos pendentes. Marcando como concluída.`);
          await prisma.campaign.update({
            where: { id: c.id },
            data: { status: 'completed' },
          });
        }
        continue;
      }

      // Se a campanha já está sendo processada ou já está na fila, pula para não duplicar
      if (activeCampaignIds.has(c.id) || queuedCampaignIds.has(c.id)) {
        continue;
      }

      let delayMs = 0;
      if (c.scheduledAt) {
        const diff = new Date(c.scheduledAt).getTime() - Date.now();
        delayMs = diff > 0 ? diff : 0;
      }

      console.log(`[Worker] Auto-recuperando campanha pendente: "${c.name}" (ID: ${c.id}) com delay de ${delayMs}ms`);
      await campaignQueue.add(
        'start-campaign',
        { campaignId: c.id },
        {
          delay: delayMs,
          jobId: `campaign-${c.id}`,
          removeOnComplete: true,
          removeOnFail: true,
        }
      );
      queuedCampaignIds.add(c.id);
    }
  } catch (err: any) {
    console.warn('[Worker] Erro ao recuperar campanhas pendentes:', err?.message);
  }
}

// Inicia recuperação 3 segundos após boot e a cada 30 segundos continuamente
setTimeout(recoverPendingCampaigns, 3000);
setInterval(recoverPendingCampaigns, 30000);
