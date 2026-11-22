import { NextResponse } from 'next/server';
import { testMetaCredentials } from '@/src/lib/providers/meta';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { phoneNumberId, accessToken } = body;

    if (!phoneNumberId || !accessToken) {
      return NextResponse.json(
        { ok: false, error: 'Phone Number ID e Access Token são obrigatórios para validar na Meta.' },
        { status: 400 }
      );
    }

    const result = await testMetaCredentials({
      phoneNumberId: phoneNumberId.trim(),
      accessToken: accessToken.trim(),
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error || 'Credenciais inválidas ou rejeitadas pela Meta.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      verifiedName: result.verifiedName,
      displayPhoneNumber: result.displayPhoneNumber,
      qualityRating: result.qualityRating,
      platformType: result.platformType,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Erro ao comunicar com a Meta Cloud API.' },
      { status: 500 }
    );
  }
}
