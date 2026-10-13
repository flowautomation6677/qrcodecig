import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const instance = body.instance || process.env.EVOLUTION_INSTANCE_NAME;

    if (!instance) {
      return NextResponse.json(
        { error: 'Nome da instância não configurado.' },
        { status: 400 }
      );
    }

    const apiUrl = process.env.EVOLUTION_API_URL?.replace(/\/$/, '');
    const apiKey = process.env.EVOLUTION_API_KEY;

    if (!apiUrl || !apiKey) {
      return NextResponse.json(
        { error: 'Configuração da Evolution API ausente no servidor.' },
        { status: 500 }
      );
    }

    // 1. Tenta logout para limpar qualquer sessão corrompida
    try {
      await fetch(`${apiUrl}/instance/logout/${encodeURIComponent(instance)}`, {
        method: 'DELETE',
        headers: { apikey: apiKey, 'Content-Type': 'application/json' },
      });
    } catch {}

    // 2. Tenta restart da instância no Baileys
    try {
      await fetch(`${apiUrl}/instance/restart/${encodeURIComponent(instance)}`, {
        method: 'POST',
        headers: { apikey: apiKey, 'Content-Type': 'application/json' },
      });
    } catch {}

    return NextResponse.json({ success: true, message: 'Instância reiniciada com sucesso' });
  } catch (error: any) {
    console.error('Erro ao reiniciar instância:', error);
    return NextResponse.json(
      { error: 'Erro ao reiniciar instância', details: error?.message || 'Falha na requisição' },
      { status: 500 }
    );
  }
}
