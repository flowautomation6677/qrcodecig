import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

export const dynamic = 'force-dynamic';

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

    // Força execução imediata zerando agendamentos e marcando como running
    await prisma.campaign.update({
      where: { id: params.id },
      data: {
        status: 'running',
        pauseReason: null,
        scheduledAt: null,
        nextDispatchAt: new Date(),
      } as any,
    });

    return NextResponse.json({
      success: true,
      message: 'Disparo forçado para início imediato no próximo ciclo do worker!',
      status: 'running',
    });
  } catch (error: any) {
    console.error('Erro ao forçar disparo imediato:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
