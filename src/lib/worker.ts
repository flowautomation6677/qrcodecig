import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { prisma } from './prisma';
import dotenv from 'dotenv';

// Carrega as variáveis de ambiente
dotenv.config({ path: '.env.local' });
dotenv.config();
const connection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null,
});

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

// Função auxiliar para enviar requisições para a API local Next.js ou direto para Evolution
async function sendToEvolutionAPI(payload: any) {
  // Vamos usar a mesma lógica contida na api/whatsapp/send, chamando o servidor local Next.js para simplificar
  // e reaproveitar todo o código de formatação e compatibilidade v1/v2 que já existe na sua aplicação.
  
  const nextAppUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  
  const response = await fetch(`${nextAppUrl}/api/whatsapp/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return response;
}

const worker = new Worker('campaign-queue', async (job: Job) => {
  console.log(`[Worker] Iniciando processamento do job: ${job.id} - Campanha: ${job.data.campaignId}`);
  
  const campaign = await prisma.campaign.findUnique({
    where: { id: job.data.campaignId },
    include: { contacts: { where: { status: 'pending' } } }
  });

  if (!campaign) {
    console.error(`[Worker] Campanha ${job.data.campaignId} não encontrada.`);
    return;
  }

  // Atualiza o status para running
  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { status: 'running' }
  });

  const contacts = campaign.contacts;
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < contacts.length; i++) {
    // Verifica se a campanha foi pausada ou parada
    const currentCampaign = await prisma.campaign.findUnique({
      where: { id: campaign.id },
      select: { status: true }
    });
    
    if (currentCampaign?.status !== 'running') {
      console.log(`[Worker] Campanha ${campaign.id} interrompida. Status atual: ${currentCampaign?.status}`);
      break;
    }

    const contact = contacts[i];
    const finalText = parseSpintax(injectVariables(campaign.messageTemplate, contact));
    
    console.log(`[Worker] Enviando para ${contact.number}...`);

    try {
      // 1. Validar (Check)
      const checkRes = await sendToEvolutionAPI({
        action: 'check', number: contact.number, instance: campaign.instanceName
      });
      const checkData = await checkRes.json();
      
      if (!checkData.exists && checkRes.ok) {
        await prisma.contact.update({ where: { id: contact.id }, data: { status: 'failed', error: 'Número não possui WhatsApp' } });
        failed++;
        continue;
      }

      // 2. Presence
      const isAudio = campaign.messageMode === 'audio';
      const typingDelay = isAudio ? 5000 : Math.min(Math.max(finalText.length * 50, 3000), 12000);
      
      await sendToEvolutionAPI({
        action: 'presence',
        number: contact.number,
        instance: campaign.instanceName,
        delay: typingDelay,
        mediaType: isAudio ? 'audio' : 'text'
      });
      await delay(typingDelay);

      // 3. Enviar Mensagem
      let sendRes;
      if (campaign.messageMode === 'text') {
        sendRes = await sendToEvolutionAPI({
          action: 'sendText',
          number: contact.number,
          message: finalText,
          instance: campaign.instanceName
        });
      } else if (campaign.messageMode === 'image') {
        sendRes = await sendToEvolutionAPI({
          action: 'sendMedia',
          number: contact.number,
          mediaType: 'image',
          mediaBase64: campaign.mediaBase64,
          mediaUrl: campaign.mediaUrl,
          fileName: campaign.fileName || 'imagem.jpg',
          caption: finalText,
          instance: campaign.instanceName
        });
      } else {
        sendRes = await sendToEvolutionAPI({
          action: 'sendAudio',
          number: contact.number,
          mediaBase64: campaign.mediaBase64,
          mediaUrl: campaign.mediaUrl,
          fileName: campaign.fileName || 'audio.ogg',
          isPtt: campaign.isPtt,
          caption: finalText,
          instance: campaign.instanceName
        });
      }

      if (sendRes.ok) {
        await prisma.contact.update({ where: { id: contact.id }, data: { status: 'sent', sentAt: new Date() } });
        sent++;
      } else {
        const err = await sendRes.json();
        await prisma.contact.update({ where: { id: contact.id }, data: { status: 'failed', error: JSON.stringify(err) } });
        failed++;
      }
    } catch (e: any) {
      await prisma.contact.update({ where: { id: contact.id }, data: { status: 'failed', error: e.message } });
      failed++;
    }

    // 4. Cadência (Anti-Ban)
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

  // Finaliza a Campanha se concluiu todos os contatos
  const updatedCampaign = await prisma.campaign.findUnique({ where: { id: campaign.id } });
  if (updatedCampaign?.status === 'running') {
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: 'completed' }
    });
    console.log(`[Worker] Campanha ${campaign.id} concluída. Enviados: ${sent}, Falhas: ${failed}`);
  }
}, { connection });

worker.on('failed', (job: Job | undefined, err: Error) => {
  console.error(`[Worker] Job ${job?.id} falhou com erro: ${err.message}`);
});

console.log('[Worker] Worker iniciado e aguardando campanhas na fila "campaign-queue"...');
