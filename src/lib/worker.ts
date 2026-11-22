import dotenv from 'dotenv';
import { prisma, pool, ensureDatabaseSchema } from './prisma';
import { renderTemplate } from './template';
import { evaluateSchedule, WindowConfig, ScheduleConfig } from './schedule';
import { sendMetaTemplateMessage } from './providers/meta';

// Carrega variáveis de ambiente
dotenv.config({ path: '.env.local' });
dotenv.config();

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface EvolutionCheckResult {
  exists: boolean;
  number?: string;
}

/**
 * Consulta o status da conexão da instância diretamente na Evolution API.
 */
async function checkInstanceStatus(instanceName: string): Promise<boolean> {
  const apiUrl = process.env.EVOLUTION_API_URL?.replace(/\/$/, '');
  const apiKey = process.env.EVOLUTION_API_KEY;

  if (!apiUrl || !apiKey || !instanceName) {
    return true; // Se não configurado, não bloqueia
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(`${apiUrl}/instance/connectionState/${encodeURIComponent(instanceName)}`, {
      method: 'GET',
      headers: { apikey: apiKey, 'Content-Type': 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return false;
    const data = await res.json();
    const state = data?.instance?.state || data?.state;
    return state === 'open';
  } catch (err: any) {
    console.warn(`[Worker] Falha ao verificar status da instância "${instanceName}":`, err?.message);
    return false;
  }
}

/**
 * Envia comandos para a Evolution API.
 */
async function sendToEvolution(payload: {
  action: 'presence' | 'check' | 'sendText' | 'sendMedia' | 'sendAudio';
  instance: string;
  number: string;
  message?: string;
  delay?: number;
  mediaType?: string;
  mediaUrl?: string;
  mediaBase64?: string;
  fileName?: string;
  caption?: string;
  isPtt?: boolean;
}): Promise<{ ok: boolean; status: number; data?: any; error?: string }> {
  const { action, number, message, instance, delay: pDelay, mediaType, mediaUrl, mediaBase64, fileName, caption, isPtt } = payload;
  const apiUrl = process.env.EVOLUTION_API_URL?.replace(/\/$/, '');
  const apiKey = process.env.EVOLUTION_API_KEY;

  if (!apiUrl || !apiKey) {
    return { ok: false, status: 500, error: 'Evolution API URL ou Key não configurados no servidor' };
  }

  try {
    // 1. PRESENCE (simula digitação ou gravação)
    if (action === 'presence') {
      const presenceType = mediaType === 'audio' ? 'recording' : 'composing';
      const res = await fetch(`${apiUrl}/chat/sendPresence/${encodeURIComponent(instance)}`, {
        method: 'POST',
        headers: { apikey: apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ number, presence: presenceType, delay: pDelay || 5000 }),
      });
      return { ok: res.ok, status: res.status };
    }

    // 2. CHECK (valida se o número possui WhatsApp ativo)
    if (action === 'check') {
      const res = await fetch(`${apiUrl}/chat/whatsappNumbers/${encodeURIComponent(instance)}`, {
        method: 'POST',
        headers: { apikey: apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ numbers: [number] }),
      });

      if (!res.ok) {
        // Se a verificação falhar por instabilidade na Evolution, assume que existe para tentar enviar
        return { ok: true, status: 200, data: { exists: true } };
      }

      const data = await res.json();
      const exists = Array.isArray(data) && data.length > 0 ? Boolean(data[0]?.exists) : true;
      return { ok: true, status: 200, data: { exists } };
    }

    // 3. SEND TEXT
    if (action === 'sendText') {
      const res = await fetch(`${apiUrl}/message/sendText/${encodeURIComponent(instance)}`, {
        method: 'POST',
        headers: { apikey: apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number,
          text: message,
          options: { delay: 0, presence: 'composing', linkPreview: true },
          textMessage: { text: message },
        }),
      });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data };
    }

    // 4. SEND MEDIA (Imagem ou Vídeo)
    if (action === 'sendMedia') {
      let mediaData = mediaBase64 || mediaUrl;
      if (mediaData && mediaData.startsWith('data:')) {
        mediaData = mediaData.substring(mediaData.indexOf(',') + 1);
      }

      const res = await fetch(`${apiUrl}/message/sendMedia/${encodeURIComponent(instance)}`, {
        method: 'POST',
        headers: { apikey: apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number,
          mediatype: mediaType || 'image',
          media: mediaData,
          caption: caption || message || '',
          fileName: fileName || (mediaType === 'video' ? 'video.mp4' : 'imagem.jpg'),
          options: { delay: 0, presence: 'composing' },
          mediaMessage: {
            mediatype: mediaType || 'image',
            caption: caption || message || '',
            media: mediaData,
            fileName: fileName || (mediaType === 'video' ? 'video.mp4' : 'imagem.jpg'),
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data };
    }

    // 5. SEND AUDIO (Nota de voz PTT ou arquivo)
    if (action === 'sendAudio') {
      let audioData = mediaBase64 || mediaUrl;
      if (audioData && audioData.startsWith('data:')) {
        audioData = audioData.substring(audioData.indexOf(',') + 1);
      }

      const endpoint = isPtt !== false ? 'sendWhatsAppAudio' : 'sendMedia';
      const body =
        isPtt !== false
          ? {
            number,
            audio: audioData,
            options: { delay: 0, presence: 'recording', encoding: true },
            audioMessage: { audio: audioData },
          }
          : {
            number,
            mediatype: 'audio',
            media: audioData,
            fileName: fileName || 'audio.ogg',
            options: { delay: 0, presence: 'recording' },
            mediaMessage: { mediatype: 'audio', media: audioData, fileName: fileName || 'audio.ogg' },
          };

      const res = await fetch(`${apiUrl}/message/${endpoint}/${encodeURIComponent(instance)}`, {
        method: 'POST',
        headers: { apikey: apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data };
    }

    return { ok: false, status: 400, error: 'Ação de envio não suportada' };
  } catch (err: any) {
    return { ok: false, status: 500, error: err.message };
  }
}

/**
 * Recupera contatos que ficaram presos em 'processing' por mais de 5 minutos
 * (por exemplo, após queda de energia ou restart de container).
 */
async function recoverStuckProcessingContacts() {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const result = await prisma.contact.updateMany({
      where: {
        status: 'processing',
        lockedAt: { lt: fiveMinutesAgo },
      } as any,
      data: {
        status: 'pending',
        lockedAt: null,
      } as any,
    });

    if (result.count > 0) {
      console.log(`[Worker] Auto-recuperados ${result.count} destinatários presos em 'processing'.`);
    }
  } catch (err: any) {
    console.warn('[Worker] Aviso ao auto-recuperar contatos presos:', err?.message);
  }
}

/**
 * Processa 1 destinatário de uma campanha ativa com lock atômico.
 */
async function processCampaignStep(campaignId: string) {
  // 1. Carrega dados atualizados da campanha e do cliente associado
  const campaign: any = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { client: true },
  });

  if (!campaign || !['running', 'scheduled', 'waiting_next_window', 'pending'].includes(campaign.status)) {
    return;
  }

  const isMeta = campaign.provider === 'meta_official' || campaign.client?.provider === 'meta_official';

  // 2. Health check da conexão
  if (isMeta) {
    const metaPhoneId = campaign.client?.metaPhoneNumberId;
    const metaToken = campaign.client?.metaAccessToken;
    if (!metaPhoneId || !metaToken) {
      console.warn(`[Worker] Campanha Meta Oficial "${campaign.name}" sem Phone Number ID ou Access Token configurados.`);
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: {
          status: 'paused',
          pauseReason: 'Credenciais da Meta Cloud API ausentes ou incompletas no cadastro do cliente.',
        } as any,
      });
      return;
    }
  } else {
    // Health check tradicional da Evolution API (chip/QR Code)
    const isInstanceOpen = await checkInstanceStatus(campaign.instanceName);
    if (!isInstanceOpen) {
      console.warn(`[Worker] Instância "${campaign.instanceName}" desconectada. Pausando campanha "${campaign.name}" (${campaign.id}).`);
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: {
          status: 'paused_disconnected',
          pauseReason: `Instância WhatsApp "${campaign.instanceName}" desconectada. Reconecte o WhatsApp para retomar.`,
        } as any,
      });
      return;
    }
  }

  // 3. Avalia janelas de horário e cota diária/turno
  let parsedWindows: WindowConfig[] = [];
  try {
    if (campaign.windowsJson) {
      parsedWindows = JSON.parse(campaign.windowsJson);
    }
  } catch { }

  let parsedAllowedDays = [1, 2, 3, 4, 5];
  try {
    if (campaign.allowedDays) {
      parsedAllowedDays = JSON.parse(campaign.allowedDays);
    }
  } catch { }

  const scheduleConfig: ScheduleConfig = {
    timezone: campaign.timezone || 'America/Sao_Paulo',
    allowedDays: parsedAllowedDays,
    windows: parsedWindows.length > 0 ? parsedWindows : [{ start: '08:00', end: '18:00', limit: 0 }],
    dailyLimit: campaign.dailyLimit || 0,
  };

  const scheduleResult = evaluateSchedule(
    scheduleConfig,
    {
      currentSlot: campaign.currentSlot,
      currentSlotCount: campaign.currentSlotCount,
      todayDate: campaign.todayDate,
      todayCount: campaign.todayCount,
    },
    new Date()
  );

  // Se não pode disparar agora (fora de horário, limite atingido ou final de semana)
  if (!scheduleResult.canDispatch) {
    console.log(
      `[Worker] Campanha "${campaign.name}" aguardando janela. Motivo: ${scheduleResult.reason}. Próximo disparo em: ${scheduleResult.nextDispatchAt?.toISOString()}`
    );

    await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        status: 'waiting_next_window',
        pauseReason: scheduleResult.reason || 'Aguardando próxima janela permitida',
        nextDispatchAt: scheduleResult.nextDispatchAt,
        currentSlot: scheduleResult.slotKey,
        currentSlotCount: scheduleResult.currentSlotCount,
        todayDate: scheduleResult.todayDate,
        todayCount: scheduleResult.todayCount,
      } as any,
    });
    return;
  }

  // Se a campanha estava aguardando ou agendada e a janela abriu, transiciona para 'running'
  if (campaign.status !== 'running') {
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: 'running', pauseReason: null } as any,
    });
  }

  // 4. Lock atômico por destinatário (PostgreSQL FOR UPDATE SKIP LOCKED)
  // Seleciona 1 contato pendente e transiciona atomicamente para 'processing'
  const lockQuery = `
    UPDATE "Contact"
    SET status = 'processing', "lockedAt" = NOW()
    WHERE id = (
      SELECT id FROM "Contact"
      WHERE "campaignId" = $1 AND status = 'pending'
      ORDER BY "createdAt" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, number, "normalizedPhone", name, "contactGroupKey", "variablesJson";
  `;

  let contact: any = null;
  try {
    const rawResult = await pool.query(lockQuery, [campaign.id]);
    if (rawResult.rows && rawResult.rows.length > 0) {
      contact = rawResult.rows[0];
    }
  } catch (dbErr: any) {
    console.error(`[Worker] Erro ao obter lock atômico de contato na campanha ${campaign.id}:`, dbErr.message);
    return;
  }

  // Se não há contato pendente, verifica se a campanha foi concluída
  if (!contact) {
    const pendingOrProcessingCount = await prisma.contact.count({
      where: {
        campaignId: campaign.id,
        status: { in: ['pending', 'processing'] },
      },
    });

    if (pendingOrProcessingCount === 0) {
      console.log(`[Worker] Campanha "${campaign.name}" (${campaign.id}) não possui contatos pendentes. Concluindo.`);
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: 'completed' },
      });
    }
    return;
  }

  const targetNumber = contact.normalizedPhone || contact.number;
  console.log(`[Worker] Processando disparo para ${targetNumber} (Campanha: "${campaign.name}")...`);

  // 5. Pré-validação com a Evolution API (valida se o número tem WhatsApp)
  // Nota: A API Oficial da Meta já valida em tempo real e não precisa deste pré-check
  if (!isMeta && campaign.validateWhatsApp) {
    const checkRes = await sendToEvolution({
      action: 'check',
      instance: campaign.instanceName,
      number: targetNumber,
    });

    const exists = checkRes.ok && checkRes.data ? checkRes.data.exists : true;

    if (!exists) {
      console.log(`[Worker] Número ${targetNumber} não possui WhatsApp ativo. Marcando como NO_WHATSAPP (sem queimar cota).`);
      await prisma.contact.update({
        where: { id: contact.id },
        data: {
          status: 'no_whatsapp',
          error: 'Número não possui conta de WhatsApp ativa',
          lockedAt: null,
        } as any,
      });

      // Micro-delay de 2.5s antes de pegar o próximo número
      await delay(2500);
      return;
    }
  }

  // 6. Variáveis e Parser do template
  let extraVariables: Record<string, any> = {};
  try {
    if (contact.variablesJson) {
      extraVariables = JSON.parse(contact.variablesJson);
    }
  } catch { }

  const finalText = renderTemplate(campaign.messageTemplate || '', {
    name: contact.name,
    phone: targetNumber,
    variables: extraVariables,
    now: new Date(),
    timezone: campaign.timezone,
    keepTitles: campaign.keepTitles ?? false,
  });

  // 7. Execução do Envio Efetivo (Meta Oficial vs Evolution API)
  let sendResult: { ok: boolean; status?: string | number; messageId?: string; data?: any; rawData?: any; error?: string };

  if (isMeta) {
    const metaPhoneId = campaign.client?.metaPhoneNumberId;
    const metaToken = campaign.client?.metaAccessToken;

    const headerType = campaign.messageMode === 'video' ? 'video' : campaign.messageMode === 'image' ? 'image' : undefined;
    const headerUrl = campaign.mediaUrl || undefined;

    let bodyParameters: string[] = [];
    if (campaign.metaTemplateComponents) {
      try {
        const comps = typeof campaign.metaTemplateComponents === 'string'
          ? JSON.parse(campaign.metaTemplateComponents)
          : campaign.metaTemplateComponents;

        if (Array.isArray(comps)) {
          bodyParameters = comps.map((paramKey: string) => {
            if (paramKey === 'primeiro_nome') {
              const parts = (contact.name || '').trim().split(/\s+/);
              return parts[0] || '';
            }
            if (paramKey === 'nome_completo') return contact.name || '';
            return extraVariables[paramKey] || '';
          });
        }
      } catch {}
    }

    sendResult = await sendMetaTemplateMessage({
      phoneNumberId: metaPhoneId,
      accessToken: metaToken,
      to: targetNumber,
      templateName: campaign.metaTemplateName || 'template_kelly',
      languageCode: campaign.metaTemplateLanguage || 'pt_BR',
      headerType,
      headerUrl,
      bodyParameters,
    });
  } else {
    // Simulação de Presença (Digitando / Gravando) na Evolution
    const isAudio = campaign.messageMode === 'audio';
    const isVideo = campaign.messageMode === 'video';
    const typingDelayMs = isAudio
      ? 5000
      : isVideo
        ? 8000
        : Math.min(Math.max((finalText.length || 20) * 40, 2500), 10000);

    await sendToEvolution({
      action: 'presence',
      instance: campaign.instanceName,
      number: targetNumber,
      delay: typingDelayMs,
      mediaType: isAudio ? 'audio' : isVideo ? 'video' : 'text',
    });

    await delay(typingDelayMs);

    if (campaign.messageMode === 'text') {
      sendResult = await sendToEvolution({
        action: 'sendText',
        instance: campaign.instanceName,
        number: targetNumber,
        message: finalText,
      });
    } else if (campaign.messageMode === 'image') {
      sendResult = await sendToEvolution({
        action: 'sendMedia',
        instance: campaign.instanceName,
        number: targetNumber,
        mediaType: 'image',
        mediaBase64: campaign.mediaBase64 || undefined,
        mediaUrl: campaign.mediaUrl || undefined,
        fileName: campaign.fileName || 'imagem.jpg',
        caption: finalText,
      });
    } else if (campaign.messageMode === 'video') {
      sendResult = await sendToEvolution({
        action: 'sendMedia',
        instance: campaign.instanceName,
        number: targetNumber,
        mediaType: 'video',
        mediaBase64: campaign.mediaBase64 || undefined,
        mediaUrl: campaign.mediaUrl || undefined,
        fileName: campaign.fileName || 'video.mp4',
        caption: finalText,
      });
    } else {
      // Áudio (PTT ou arquivo)
      sendResult = await sendToEvolution({
        action: 'sendAudio',
        instance: campaign.instanceName,
        number: targetNumber,
        mediaBase64: campaign.mediaBase64 || undefined,
        mediaUrl: campaign.mediaUrl || undefined,
        fileName: campaign.fileName || 'audio.ogg',
        isPtt: campaign.isPtt,
        caption: finalText,
      });
    }
  }

  // 8. Atualização de Resultados e Cotas
  if (sendResult.ok) {
    console.log(`[Worker] ✅ Envio com sucesso para ${targetNumber}${isMeta ? ' (via Meta Cloud API)' : ''}`);
    await prisma.contact.update({
      where: { id: contact.id },
      data: {
        status: 'sent',
        sentAt: new Date(),
        metaMessageId: sendResult.messageId || null,
        metaStatus: typeof sendResult.status === 'string' ? sendResult.status : 'accepted',
        error: null,
        lockedAt: null,
      } as any,
    });

    // Se stopGroupOnSuccess estiver ativado e o contato tiver outros telefones no mesmo grupo
    if (campaign.stopGroupOnSuccess && contact.contactGroupKey) {
      const skipped = await prisma.contact.updateMany({
        where: {
          campaignId: campaign.id,
          contactGroupKey: contact.contactGroupKey,
          status: 'pending',
          id: { not: contact.id },
        } as any,
        data: {
          status: 'skipped_group_done',
          error: 'Contato atendido com sucesso em outro número',
        },
      });
      if (skipped.count > 0) {
        console.log(`[Worker] ${skipped.count} telefone(s) adicionais do grupo "${contact.contactGroupKey}" marcados como SKIPPED_GROUP_DONE.`);
      }
    }

    // Incrementa contadores de cota consumida
    const newSlotCount = scheduleResult.currentSlotCount + 1;
    const newTodayCount = scheduleResult.todayCount + 1;

    // Calcula intervalo entre envios (cadência ágil para Meta vs anti-ban para chip)
    const defaultMin = isMeta ? 2 : 15;
    const defaultMax = isMeta ? 5 : 45;
    const minDelay = Math.max(campaign.delayMin || defaultMin, 1);
    const maxDelay = Math.max(campaign.delayMax || defaultMax, minDelay);
    const waitSeconds = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
    const nextDispatch = new Date(Date.now() + waitSeconds * 1000);

    await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        currentSlot: scheduleResult.slotKey,
        currentSlotCount: newSlotCount,
        todayDate: scheduleResult.todayDate,
        todayCount: newTodayCount,
        nextDispatchAt: nextDispatch,
      } as any,
    });
  } else {
    const errorDetails = sendResult.error || JSON.stringify(sendResult.data || sendResult.rawData) || 'Falha no envio';
    console.warn(`[Worker] ❌ Falha no envio para ${targetNumber}:`, errorDetails);

    const isNoWhatsApp = isMeta && (
      errorDetails.includes('131026') ||
      errorDetails.toLowerCase().includes('not a valid whatsapp') ||
      errorDetails.toLowerCase().includes('undeliverable')
    );

    if (isNoWhatsApp) {
      console.log(`[Worker] Destinatário ${targetNumber} não possui WhatsApp na Meta. Marcando como NO_WHATSAPP.`);
      await prisma.contact.update({
        where: { id: contact.id },
        data: {
          status: 'no_whatsapp',
          error: errorDetails,
          lockedAt: null,
        } as any,
      });
    } else {
      await prisma.contact.update({
        where: { id: contact.id },
        data: {
          status: 'failed',
          error: errorDetails,
          lockedAt: null,
        } as any,
      });
    }

    // Delay de segurança pós-erro
    const nextDispatch = new Date(Date.now() + Math.max(campaign.delayMin || (isMeta ? 2 : 15), 2) * 1000);
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { nextDispatchAt: nextDispatch } as any,
    });
  }
}

/**
 * Loop principal do Worker (executado a cada 10-15s).
 */
export async function runWorkerIteration() {
  try {
    // 1. Recupera destinatários presos em 'processing'
    await recoverStuckProcessingContacts();

    // 2. Busca todas as campanhas elegíveis para disparo no momento
    const now = new Date();
    const activeCampaigns = await prisma.campaign.findMany({
      where: {
        status: { in: ['running', 'scheduled', 'waiting_next_window', 'pending'] },
        OR: [{ nextDispatchAt: null }, { nextDispatchAt: { lte: now } }],
      } as any,
      select: { id: true, name: true },
      take: 5,
    });

    for (const c of activeCampaigns) {
      await processCampaignStep(c.id);
    }
  } catch (err: any) {
    console.error('[Worker Loop] Erro na iteração do worker:', err.message);
  }
}

let isRunning = false;

export async function startWorkerDaemon() {
  if (isRunning) return;
  isRunning = true;
  console.log('====================================================');
  console.log('[Worker] Worker Autocontido de Campanhas Iniciado!');
  console.log('[Worker] Persistência: 100% PostgreSQL | Zero Redis');
  console.log('====================================================');

  await ensureDatabaseSchema();

  while (isRunning) {
    await runWorkerIteration();
    await delay(12000); // 12 segundos entre ticks do loop
  }
}

// Execução direta quando disparado via CLI / runner.js
if (require.main === module || process.argv[1]?.includes('worker')) {
  startWorkerDaemon().catch((err) => {
    console.error('[Worker Fatal] Erro fatal no worker:', err);
    process.exit(1);
  });
}
