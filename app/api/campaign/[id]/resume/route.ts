import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const campaign = await prisma.campaign.findUnique({ where: { id: params.id } });
    if (!campaign) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 });

    let status = 'running';
    let nextDispatchAt = new Date();

    if (campaign.scheduledAt && new Date(campaign.scheduledAt) > new Date()) {
      status = 'scheduled';
      nextDispatchAt = new Date(campaign.scheduledAt);
    }

    await prisma.campaign.update({
      where: { id: params.id },
      data: {
        status,
        pauseReason: null,
        nextDispatchAt,
      } as any,
    });

    return NextResponse.json({ success: true, status });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
