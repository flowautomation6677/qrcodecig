import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { campaignQueue } from '@/src/lib/queue';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const campaign = await prisma.campaign.findUnique({ where: { id: params.id }});
    if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    
    // Resume depends on scheduledAt
    let status = 'pending';
    let delayMs = 0;
    if (campaign.scheduledAt) {
      const now = new Date();
      delayMs = new Date(campaign.scheduledAt).getTime() - now.getTime();
      if (delayMs > 0) {
        status = 'scheduled';
      } else {
        delayMs = 0;
      }
    }
    
    await prisma.campaign.update({
      where: { id: params.id },
      data: { status }
    });
    
    // add back to queue
    await campaignQueue.add(
      'start-campaign',
      { campaignId: campaign.id },
      { delay: delayMs }
    );
    
    return NextResponse.json({ success: true, status });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
