import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const instance = body.instance || process.env.EVOLUTION_INSTANCE_NAME;

    if (!instance) {
      return NextResponse.json(
        { error: 'Nome da instância não configurado. Defina EVOLUTION_INSTANCE_NAME no arquivo .env ou envie no corpo da requisição.' },
        { status: 400 }
      );
    }

    const apiUrl = process.env.EVOLUTION_API_URL?.replace(/\/$/, '');
    const apiKey = process.env.EVOLUTION_API_KEY;

    if (!apiUrl || !apiKey) {
      return NextResponse.json(
        { error: 'Configuração da Evolution API ausente no servidor' },
        { status: 500 }
      );
    }

    const response = await fetch(`${apiUrl}/instance/logout/${encodeURIComponent(instance)}`, {
      method: 'DELETE',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error('Erro ao desconectar instância:', error);
    return NextResponse.json(
      { error: 'Erro ao desconectar', details: error?.message || 'Falha na requisição' },
      { status: 500 }
    );
  }
}
