import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { getLocalTimeComponents, WindowConfig } from '@/src/lib/schedule';

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

    // Calcula componentes locais no fuso America/Sao_Paulo
    const timezone = campaign.timezone || 'America/Sao_Paulo';
    const localNow = getLocalTimeComponents(new Date(), timezone);

    let allowedDays: number[] = [1, 2, 3, 4, 5];
    try {
      if (campaign.allowedDays) {
        allowedDays = JSON.parse(campaign.allowedDays);
      }
    } catch {}

    let windows: WindowConfig[] = [];
    try {
      if (campaign.windowsJson) {
        windows = JSON.parse(campaign.windowsJson);
      }
    } catch {}

    // 1. Se o dia de hoje não estava liberado (ex: Domingo/Sábado), inclui hoje automaticamente
    if (!allowedDays.includes(localNow.dayOfWeek)) {
      allowedDays.push(localNow.dayOfWeek);
      allowedDays.sort((a, b) => a - b);
    }

    // 2. Se o horário atual estiver fora de qualquer janela configurada, abre uma janela para agora
    const currentMins = localNow.minutesOfDay;
    const hasActiveWindow = windows.some((w) => {
      const [sh, sm] = w.start.split(':').map(Number);
      const [eh, em] = w.end.split(':').map(Number);
      return currentMins >= (sh * 60 + sm) && currentMins < (eh * 60 + em);
    });

    if (!hasActiveWindow) {
      const currentHStr = String(localNow.hour).padStart(2, '0');
      const currentMStr = String(localNow.minute).padStart(2, '0');
      windows.push({
        start: `${currentHStr}:${currentMStr}`,
        end: '23:59',
        limit: 0,
      });
    }

    // Força execução imediata zerando agendamentos, removendo pauseReason e marcando como running
    await prisma.campaign.update({
      where: { id: params.id },
      data: {
        status: 'running',
        pauseReason: null,
        scheduledAt: null,
        nextDispatchAt: new Date(),
        allowedDays: JSON.stringify(allowedDays),
        windowsJson: JSON.stringify(windows),
      } as any,
    });

    return NextResponse.json({
      success: true,
      message: 'Disparo forçado com sucesso! O dia atual e o horário foram liberados para envio imediato.',
      status: 'running',
    });
  } catch (error: any) {
    console.error('Erro ao forçar disparo imediato:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
