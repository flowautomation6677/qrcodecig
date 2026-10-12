import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

export const dynamic = 'force-dynamic';

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const client = await prisma.client.findUnique({
      where: { id },
    });

    if (!client) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
    }

    // Opcional: tentar desconectar/deletar na Evolution API
    const apiUrl = process.env.EVOLUTION_API_URL?.replace(/\/$/, '');
    const apiKey = process.env.EVOLUTION_API_KEY;

    if (apiUrl && apiKey && client.instanceName) {
      try {
        await fetch(`${apiUrl}/instance/delete/${encodeURIComponent(client.instanceName)}`, {
          method: 'DELETE',
          headers: { apikey: apiKey },
        });
      } catch (err) {
        console.warn('Erro ao deletar instância na Evolution API:', err);
      }
    }

    await prisma.client.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Cliente removido com sucesso' });
  } catch (error: any) {
    console.error('Erro ao deletar cliente:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
