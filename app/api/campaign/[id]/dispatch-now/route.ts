import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { campaignQueue } from '@/src/lib/queue';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: params.id },
      include: {
        contacts: {
          where: { status: 'pending' },
          take: 1,
        },
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 });
    }

    if (!campaign.contacts || campaign.contacts.length === 0) {
      return NextResponse.json({ error: 'Campanha não possui contatos pendentes para envio' }, { status: 400 });
    }

    // Atualiza status para 'pending' e zera agendamento futuro
    await prisma.campaign.update({
      where: { id: params.id },
      data: {
        status: 'pending',
        scheduledAt: null,
      },
    });

    // Enfileira imediatamente sem nenhum delay
    await campaignQueue.add(
      'start-campaign',
      { campaignId: campaign.id },
      {
        delay: 0,
        jobId: `force-${campaign.id}-${Date.now()}`,
        removeOnComplete: true,
        removeOnFail: true,
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Disparo imediato enfileirado com sucesso!',
      status: 'pending',
    });
  } catch (error: any) {
    console.error('Erro ao forçar disparo imediato:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
