import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { campaignQueue } from '@/src/lib/queue';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    const whereClause = clientId ? { clientId } : {};

    const statusCounts = await prisma.campaign.groupBy({
      by: ['status'],
      where: whereClause,
      _count: {
        id: true,
      },
    });

    const total = await prisma.campaign.count({
      where: whereClause,
    });

    const stats = {
      total,
      completed: statusCounts.find((s) => s.status === 'completed')?._count.id || 0,
      running: statusCounts.find((s) => s.status === 'running')?._count.id || 0,
      scheduled: statusCounts.find((s) => s.status === 'scheduled')?._count.id || 0,
    };

    const campaigns = await prisma.campaign.findMany({
      where: whereClause,
      take: 50,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        status: true,
        instanceName: true,
        scheduledAt: true,
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
      },
    });

    return NextResponse.json({ campaigns, stats });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
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
    } = body;

    if (!instanceName || !contacts || contacts.length === 0) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
    }

    // Calcular data de agendamento (se houver)
    let scheduleDate = null;
    let delayMs = 0;

    if (scheduledAt) {
      scheduleDate = new Date(scheduledAt);
      const now = new Date();
      delayMs = scheduleDate.getTime() - now.getTime();
      if (delayMs < 0) delayMs = 0; // Se for no passado, envia agora
    }

    const status = scheduleDate && delayMs > 0 ? 'scheduled' : 'pending';

    // 1. Criar a Campanha no Banco
    const campaign = await prisma.campaign.create({
      data: {
        name: name || 'Nova Campanha',
        clientId: clientId || null,
        instanceName,
        messageMode,
        messageTemplate,
        mediaBase64,
        mediaUrl,
        fileName,
        isPtt,
        delayMin: Number(delayMin),
        delayMax: Number(delayMax),
        batchSize: Number(batchSize),
        batchPause: Number(batchPause),
        scheduledAt: scheduleDate,
        status,
        contacts: {
          create: contacts.map((c: any) => ({
            number: c.number,
            name: c.name || null,
          })),
        },
      },
    });

    // 2. Enfileirar o Job no BullMQ
    await campaignQueue.add(
      'start-campaign',
      { campaignId: campaign.id },
      {
        delay: delayMs,
        jobId: `campaign-${campaign.id}`,
        removeOnComplete: true,
        removeOnFail: true,
      }
    );

    return NextResponse.json({
      success: true,
      campaignId: campaign.id,
      status,
      message: status === 'scheduled' ? 'Campanha agendada com sucesso' : 'Campanha iniciada',
    });
  } catch (error: any) {
    console.error('Erro ao criar campanha:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
