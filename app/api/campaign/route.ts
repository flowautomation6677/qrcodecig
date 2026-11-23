import { NextResponse } from 'next/server';
import { prisma, ensureDatabaseSchema } from '@/src/lib/prisma';
import { normalizeBrPhone } from '@/src/lib/phone';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await ensureDatabaseSchema();

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    const whereClause = clientId ? { clientId } : {};

    const statusCounts = await prisma.campaign.groupBy({
      by: ['status'],
      where: whereClause as any,
      _count: {
        id: true,
      },
    });

    const total = await prisma.campaign.count({
      where: whereClause as any,
    });

    const stats = {
      total,
      completed: statusCounts.find((s) => s.status === 'completed')?._count.id || 0,
      running: statusCounts.find((s) => s.status === 'running')?._count.id || 0,
      scheduled: statusCounts.find((s) => s.status === 'scheduled')?._count.id || 0,
      waiting_next_window: statusCounts.find((s) => s.status === 'waiting_next_window')?._count.id || 0,
      paused: statusCounts.find((s) => s.status === 'paused' || s.status === 'paused_disconnected')?._count.id || 0,
    };

    const campaigns = await prisma.campaign.findMany({
      where: whereClause as any,
      take: 50,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        status: true,
        pauseReason: true,
        instanceName: true,
        scheduledAt: true,
        nextDispatchAt: true,
        currentSlot: true,
        currentSlotCount: true,
        todayCount: true,
        dailyLimit: true,
        provider: true,
        metaTemplateName: true,
        createdAt: true,
        clientId: true,
        client: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        _count: {
          select: { contacts: true },
        },
      } as any,
    });

    return NextResponse.json({ campaigns, stats });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureDatabaseSchema();
    const body = await req.json();
    const {
      name,
      clientId,
      instanceName,
      messageMode,
      messageTemplate,
      mediaBase64,
      mediaUrl,
      fileName,
      isPtt,
      delayMin,
      delayMax,
      batchSize,
      batchPause,
      contacts,
      scheduledAt,
      // Novos campos da campanha contínua
      timezone,
      allowedDays,
      windowsJson,
      dailyLimit,
      validateWhatsApp,
      stopGroupOnSuccess,
      keepTitles,
      dedupDays,
      allowedDdds,
      // Provedor Meta Oficial
      provider,
      metaTemplateName,
      metaTemplateLanguage,
      metaTemplateComponents,
    } = body;

    if (!instanceName || !contacts || contacts.length === 0) {
      return NextResponse.json({ error: 'Dados inválidos ou lista de contatos vazia' }, { status: 400 });
    }

    let scheduleDate = null;
    if (scheduledAt) {
      scheduleDate = new Date(scheduledAt);
      if (scheduleDate.getTime() < Date.now()) {
        scheduleDate = null; // Se for no passado, inicia imediatamente
      }
    }

    const initialStatus = scheduleDate ? 'scheduled' : 'running';
    const nextDispatchAt = scheduleDate || new Date();

    // 1. Cria a campanha com todos os parâmetros persistidos no PostgreSQL
    const campaign = await prisma.campaign.create({
      data: {
        name: name || 'Nova Campanha',
        clientId: clientId || null,
        instanceName,
        messageMode: messageMode || 'text',
        messageTemplate,
        mediaBase64: mediaBase64 || null,
        mediaUrl: mediaUrl || null,
        fileName: fileName || null,
        isPtt: isPtt !== undefined ? Boolean(isPtt) : true,
        delayMin: Number(delayMin) || 15,
        delayMax: Number(delayMax) || 45,
        batchSize: Number(batchSize) || 40,
        batchPause: Number(batchPause) || 10,
        timezone: timezone || 'America/Sao_Paulo',
        allowedDays: typeof allowedDays === 'string' ? allowedDays : JSON.stringify(allowedDays || [0, 1, 2, 3, 4, 5, 6]),
        windowsJson: typeof windowsJson === 'string' ? windowsJson : JSON.stringify(windowsJson || []),
        dailyLimit: Number(dailyLimit) || 0,
        validateWhatsApp: validateWhatsApp !== undefined ? Boolean(validateWhatsApp) : true,
        stopGroupOnSuccess: stopGroupOnSuccess !== undefined ? Boolean(stopGroupOnSuccess) : true,
        keepTitles: keepTitles !== undefined ? Boolean(keepTitles) : false,
        dedupDays: Number(dedupDays) || 30,
        allowedDdds: allowedDdds || null,
        provider: provider || 'evolution',
        metaTemplateName: metaTemplateName || null,
        metaTemplateLanguage: metaTemplateLanguage || 'pt_BR',
        metaTemplateComponents: typeof metaTemplateComponents === 'string' ? metaTemplateComponents : (metaTemplateComponents ? JSON.stringify(metaTemplateComponents) : null),
        scheduledAt: scheduleDate,
        nextDispatchAt,
        status: initialStatus,
        contacts: {
          create: contacts.map((c: any) => {
            const rawPhone = String(c.normalizedPhone || c.number || '');
            const norm = normalizeBrPhone(rawPhone);
            const normalizedPhone = norm.isValid ? norm.normalized : rawPhone.replace(/\D/g, '');

            return {
              number: String(c.number || rawPhone),
              normalizedPhone,
              name: c.name || null,
              clientId: clientId || null,
              contactGroupKey: c.contactGroupKey || null,
              variablesJson: c.variables ? JSON.stringify(c.variables) : (c.variablesJson || null),
              status: 'pending',
            };
          }),
        },
      } as any,
    });

    console.log(`[API Campaign] Campanha "${campaign.name}" (${campaign.id}) criada com sucesso com ${contacts.length} destinatários.`);

    return NextResponse.json({
      success: true,
      campaignId: campaign.id,
      status: initialStatus,
      message: initialStatus === 'scheduled' ? 'Campanha agendada com sucesso' : 'Campanha criada e pronta para disparo',
    });
  } catch (error: any) {
    console.error('Erro ao criar campanha:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
