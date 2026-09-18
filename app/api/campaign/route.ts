import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { campaignQueue } from '@/src/lib/queue';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const campaigns = await prisma.campaign.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { contacts: true }
        }
      }
    });

    // Count sent and failed using raw or separate queries, 
    // but Prisma makes it easier with a mapping or we can fetch contacts if needed.
    // To keep it light, we can fetch the contacts for stats, or just use the count.
    
    // For Dashboard, we just return the campaigns.
    return NextResponse.json({ campaigns });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      name,
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
      scheduledAt
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
            name: c.name || null
          }))
        }
      }
    });

    // 2. Enfileirar o Job no BullMQ
    // Se tiver scheduledAt, adicionamos o delay. Caso contrário, entra na fila imediatamente.
    await campaignQueue.add(
      'start-campaign',
      { campaignId: campaign.id },
      { delay: delayMs }
    );

    return NextResponse.json({ 
      success: true, 
      campaignId: campaign.id,
      status,
      message: status === 'scheduled' ? 'Campanha agendada com sucesso' : 'Campanha iniciada'
    });

  } catch (error: any) {
    console.error('Erro ao criar campanha:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
