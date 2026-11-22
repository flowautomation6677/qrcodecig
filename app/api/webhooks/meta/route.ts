import { NextResponse } from 'next/server';
import { prisma, ensureDatabaseSchema } from '@/src/lib/prisma';

export const dynamic = 'force-dynamic';

const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || 'flowrocket_meta_verify_token';

/**
 * GET /api/webhooks/meta
 * Verificação do Webhook pela Meta (Challenge Handshake).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[Meta Webhook] Desafio de verificação aceito com sucesso!');
    return new Response(challenge, { status: 200 });
  }

  return new Response('Verificação falhou ou token inválido', { status: 403 });
}

/**
 * POST /api/webhooks/meta
 * Recebimento de eventos de entrega (sent, delivered, read, failed).
 */
export async function POST(req: Request) {
  try {
    await ensureDatabaseSchema();
    const body = await req.json();

    const entries = body.entry || [];
    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        const value = change.value || {};
        const statuses = value.statuses || [];

        for (const statusObj of statuses) {
          const messageId = statusObj.id; // wamid
          const status = statusObj.status; // 'sent' | 'delivered' | 'read' | 'failed'
          const recipientId = statusObj.recipient_id;

          if (!messageId) continue;

          console.log(`[Meta Webhook] Status: ${status} | Destinatário: ${recipientId} | WAMID: ${messageId}`);

          try {
            const updateData: Record<string, any> = {
              metaStatus: status,
            };

            if (status === 'failed') {
              const errorTitle = statusObj.errors?.[0]?.title || statusObj.errors?.[0]?.message || 'Erro de entrega Meta';
              updateData.error = errorTitle;
              updateData.status = 'failed';
            }

            await prisma.contact.updateMany({
              where: { metaMessageId: messageId },
              data: updateData,
            });
          } catch (err: any) {
            console.warn(`[Meta Webhook] Erro ao atualizar status do contato ${messageId}:`, err.message);
          }
        }
      }
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error: any) {
    console.error('[Meta Webhook] Erro ao processar payload:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
