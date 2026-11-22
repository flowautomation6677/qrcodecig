import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const campaignId = params.id;

    const campaign: any = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        client: { select: { id: true, name: true, instanceName: true } },
        contacts: {
          select: {
            id: true,
            name: true,
            number: true,
            normalizedPhone: true,
            status: true,
            error: true,
            contactGroupKey: true,
            sentAt: true,
            createdAt: true,
          } as any,
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 });
    }

    // Monta o arquivo CSV com BOM UTF-8 para abrir no Excel em português sem caracteres corrompidos
    const BOM = '\uFEFF';
    const csvHeader = 'Nome;Telefone Original;Telefone Normalizado;Status;Erro;Grupo;Data Envio\r\n';

    const statusTranslations: Record<string, string> = {
      pending: 'Pendente',
      processing: 'Processando',
      sent: 'Enviado',
      no_whatsapp: 'Sem WhatsApp',
      failed: 'Falha',
      skipped_duplicate: 'Ignorado (Duplicado)',
      skipped_group_done: 'Ignorado (Contato Atendido)',
    };

    const csvRows = campaign.contacts.map((c: any) => {
      const cleanName = (c.name || '').replace(/;/g, ' ').replace(/"/g, '""');
      const cleanError = (c.error || '').replace(/;/g, ' ').replace(/"/g, '""').replace(/\n/g, ' ');
      const statusLabel = statusTranslations[c.status] || c.status;
      const sentDate = c.sentAt ? new Date(c.sentAt).toLocaleString('pt-BR') : '';

      return `"${cleanName}";"${c.number}";"${c.normalizedPhone}";"${statusLabel}";"${cleanError}";"${c.contactGroupKey || ''}";"${sentDate}"`;
    });

    const csvContent = BOM + csvHeader + csvRows.join('\r\n');
    const safeCampaignName = (campaign.name || 'campanha').replace(/[^a-zA-Z0-9_-]/g, '_');

    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="relatorio_${safeCampaignName}_${campaign.id.substring(0, 8)}.csv"`,
      },
    });
  } catch (error: any) {
    console.error('Erro ao exportar relatório CSV:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
