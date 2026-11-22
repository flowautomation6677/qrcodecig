import { NextResponse } from 'next/server';
import { prisma, ensureDatabaseSchema } from '@/src/lib/prisma';
import { testMetaCredentials } from '@/src/lib/providers/meta';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    await ensureDatabaseSchema();
    const client = await prisma.client.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: { campaigns: true },
        },
      },
    });

    if (!client) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
    }

    return NextResponse.json({ success: true, client });
  } catch (err: any) {
    console.error('Erro ao buscar cliente:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    await ensureDatabaseSchema();
    const body = await req.json();
    const {
      name,
      provider,
      metaPhoneNumberId,
      metaWabaId,
      metaAccessToken,
      instanceName,
    } = body;

    const existing = await prisma.client.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
    }

    const updateData: Record<string, any> = {};

    if (name && typeof name === 'string') {
      updateData.name = name.trim();
    }

    if (provider && (provider === 'evolution' || provider === 'meta_official')) {
      updateData.provider = provider;
    }

    // Se for ou estiver configurando Meta Oficial, valida e atualiza credenciais
    if (provider === 'meta_official' || (existing.provider === 'meta_official' && (metaPhoneNumberId || metaAccessToken))) {
      const targetPhoneId = metaPhoneNumberId !== undefined ? metaPhoneNumberId?.trim() : existing.metaPhoneNumberId;
      const targetToken = metaAccessToken !== undefined ? metaAccessToken?.trim() : existing.metaAccessToken;

      if (targetPhoneId && targetToken) {
        const testRes = await testMetaCredentials({
          phoneNumberId: targetPhoneId,
          accessToken: targetToken,
        });

        if (!testRes.ok) {
          return NextResponse.json(
            { error: `Credenciais Meta inválidas: ${testRes.error}` },
            { status: 400 }
          );
        }
      }

      if (metaPhoneNumberId !== undefined) updateData.metaPhoneNumberId = metaPhoneNumberId?.trim() || null;
      if (metaWabaId !== undefined) updateData.metaWabaId = metaWabaId?.trim() || null;
      if (metaAccessToken !== undefined) updateData.metaAccessToken = metaAccessToken?.trim() || null;
      updateData.status = 'connected';
    }

    if (instanceName && typeof instanceName === 'string') {
      updateData.instanceName = instanceName.trim();
    }

    const updated = await prisma.client.update({
      where: { id: params.id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      message: 'Cliente atualizado com sucesso!',
      client: updated,
    });
  } catch (err: any) {
    console.error('Erro ao atualizar cliente:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    await ensureDatabaseSchema();
    const existing = await prisma.client.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
    }

    // Remove cliente
    await prisma.client.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true, message: 'Cliente excluído com sucesso!' });
  } catch (err: any) {
    console.error('Erro ao excluir cliente:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
