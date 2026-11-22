import { NextResponse } from 'next/server';
import { prisma, ensureDatabaseSchema } from '@/src/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    await ensureDatabaseSchema();
    const campaignId = params.id;

    const campaign: any = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        client: {
          select: { id: true, name: true, slug: true, instanceName: true, status: true, provider: true },
        },
        contacts: {
          select: {
            id: true,
            number: true,
            normalizedPhone: true,
            name: true,
            status: true,
            error: true,
            contactGroupKey: true,
            metaMessageId: true,
            metaStatus: true,
            sentAt: true,
          } as any,
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 });
    }

    const total = campaign.contacts.length;
    const sent = campaign.contacts.filter((c: any) => c.status === 'sent').length;
    const failed = campaign.contacts.filter((c: any) => c.status === 'failed').length;
    const noWhatsApp = campaign.contacts.filter((c: any) => c.status === 'no_whatsapp').length;
    const skipped = campaign.contacts.filter((c: any) => c.status === 'skipped_group_done' || c.status === 'skipped_duplicate').length;
    const pending = campaign.contacts.filter((c: any) => c.status === 'pending' || c.status === 'processing').length;

    const currentContactIndex = sent + failed + noWhatsApp + skipped;

    return NextResponse.json({
      campaign: {
        ...campaign,
        total,
        sent,
        failed,
        noWhatsApp,
        skipped,
        pending,
        currentContactIndex,
      },
      contacts: campaign.contacts,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    await prisma.campaign.delete({
      where: { id: params.id },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH: Edição rápida da campanha (copy, mídia, janelas, limites, delays)
// Permitido sempre que a campanha não estiver em running ou completed
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const existing = await prisma.campaign.findUnique({ where: { id: params.id } });

    if (!existing) {
      return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 });
    }

    const updateData: Record<string, any> = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.messageTemplate !== undefined) updateData.messageTemplate = body.messageTemplate;
    if (body.messageMode !== undefined) updateData.messageMode = body.messageMode;
    if (body.mediaBase64 !== undefined) updateData.mediaBase64 = body.mediaBase64;
    if (body.mediaUrl !== undefined) updateData.mediaUrl = body.mediaUrl;
    if (body.fileName !== undefined) updateData.fileName = body.fileName;
    if (body.isPtt !== undefined) updateData.isPtt = Boolean(body.isPtt);

    if (body.delayMin !== undefined) updateData.delayMin = Number(body.delayMin);
    if (body.delayMax !== undefined) updateData.delayMax = Number(body.delayMax);
    if (body.batchSize !== undefined) updateData.batchSize = Number(body.batchSize);
    if (body.batchPause !== undefined) updateData.batchPause = Number(body.batchPause);

    if (body.windowsJson !== undefined) updateData.windowsJson = typeof body.windowsJson === 'string' ? body.windowsJson : JSON.stringify(body.windowsJson);
    if (body.allowedDays !== undefined) updateData.allowedDays = typeof body.allowedDays === 'string' ? body.allowedDays : JSON.stringify(body.allowedDays);
    if (body.dailyLimit !== undefined) updateData.dailyLimit = Number(body.dailyLimit);
    if (body.validateWhatsApp !== undefined) updateData.validateWhatsApp = Boolean(body.validateWhatsApp);
    if (body.stopGroupOnSuccess !== undefined) updateData.stopGroupOnSuccess = Boolean(body.stopGroupOnSuccess);
    if (body.keepTitles !== undefined) updateData.keepTitles = Boolean(body.keepTitles);

    if (body.scheduledAt !== undefined) {
      updateData.scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
      if (updateData.scheduledAt && updateData.scheduledAt > new Date()) {
        updateData.status = 'scheduled';
        updateData.nextDispatchAt = updateData.scheduledAt;
      }
    }

    const updated = await prisma.campaign.update({
      where: { id: params.id },
      data: updateData,
    });

    return NextResponse.json({ success: true, campaign: updated });
  } catch (error: any) {
    console.error('Erro no PATCH da campanha:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT: Compatibilidade com requisições antigas de edição
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  return PATCH(req, { params });
}
