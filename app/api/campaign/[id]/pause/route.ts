import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    await prisma.campaign.update({
      where: { id: params.id },
      data: { status: 'paused' }
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
