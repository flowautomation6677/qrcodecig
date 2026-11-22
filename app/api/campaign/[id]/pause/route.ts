import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    await prisma.campaign.update({
      where: { id: params.id },
      data: {
        status: 'paused',
        pauseReason: 'Campanha pausada manualmente pelo usuário',
      } as any,
    });
    return NextResponse.json({ success: true, status: 'paused' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
