import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const instance = searchParams.get('instance') || process.env.EVOLUTION_INSTANCE_NAME;

  if (!instance) {
    return NextResponse.json(
      { error: 'Nome da instância não configurado. Defina EVOLUTION_INSTANCE_NAME no arquivo .env ou informe via parâmetro.' },
      { status: 400 }
    );
  }

  const apiUrl = process.env.EVOLUTION_API_URL?.replace(/\/$/, '');
  const apiKey = process.env.EVOLUTION_API_KEY;

  if (!apiUrl || !apiKey) {
    return NextResponse.json(
      { error: 'Configuração da Evolution API ausente no servidor (EVOLUTION_API_URL ou EVOLUTION_API_KEY)' },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(`${apiUrl}/instance/connect/${encodeURIComponent(instance)}`, {
      method: 'GET',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json',
      },
      cache: 'no-store', // Evita que o Next.js faça cache de um QR code antigo
    });

    const data = await response.json();
    return NextResponse.json({ ...data, resolvedInstance: instance }, { status: response.status });
  } catch (error: any) {
    console.error('Erro ao conectar com a Evolution API:', error);
    return NextResponse.json(
      { error: 'Erro ao conectar com a Evolution API', details: error?.message || 'Falha na requisição' },
      { status: 500 }
    );
  }
}
