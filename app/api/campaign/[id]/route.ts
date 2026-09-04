import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const campaignId = params.id;
    
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        contacts: {
          select: {
            id: true,
            number: true,
            name: true,
            status: true,
            error: true,
            sentAt: true
          }
        }
      }
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 });
    }

    const total = campaign.contacts.length;
    const sent = campaign.contacts.filter(c => c.status === 'sent').length;
    const failed = campaign.contacts.filter(c => c.status === 'failed').length;
    const pending = campaign.contacts.filter(c => c.status === 'pending').length;
    
    // Calcula o progresso / currentContactIndex com base nos não-pendentes
    const currentContactIndex = sent + failed;

    return NextResponse.json({ 
      campaign: {
        status: campaign.status,
        total,
        sent,
        failed,
        currentContactIndex
      },
      contacts: campaign.contacts 
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    // Para a campanha se estiver rodando
    await prisma.campaign.update({
      where: { id: params.id },
      data: { status: 'paused' }
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
