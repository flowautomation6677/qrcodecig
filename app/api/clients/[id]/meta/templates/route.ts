import { NextResponse } from 'next/server';
import { prisma, ensureDatabaseSchema } from '@/src/lib/prisma';
import { fetchMetaTemplates } from '@/src/lib/providers/meta';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await ensureDatabaseSchema();
    const { id } = params;

    const client = await prisma.client.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        provider: true,
        metaWabaId: true,
        metaAccessToken: true,
      },
    });

    if (!client) {
      return NextResponse.json({ ok: false, error: 'Cliente não encontrado.' }, { status: 404 });
    }

    if (client.provider !== 'meta_official' || !client.metaWabaId || !client.metaAccessToken) {
      return NextResponse.json(
        { ok: false, error: 'Este cliente não está configurado com a API Oficial da Meta (WABA ID ausente).' },
        { status: 400 }
      );
    }

    const result = await fetchMetaTemplates(client.metaWabaId, client.metaAccessToken);

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error || 'Falha ao buscar templates na WABA da Meta.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      templates: result.templates || [],
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Erro interno ao consultar templates.' },
      { status: 500 }
    );
  }
}
