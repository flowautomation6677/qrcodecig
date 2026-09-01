import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, number, message, instance, delay, mediaType } = body;

    const instanceName = instance || process.env.EVOLUTION_INSTANCE_NAME;
    const apiUrl = process.env.EVOLUTION_API_URL?.replace(/\/$/, '');
    const apiKey = process.env.EVOLUTION_API_KEY;

    if (!instanceName || !apiUrl || !apiKey) {
      return NextResponse.json(
        { error: 'Configuração da Evolution API ausente no servidor.' },
        { status: 500 }
      );
    }

    // AÇÃO 1: Enviar Presença (Digitando / Gravando)
    if (action === 'presence') {
      const presencePayload = {
        number: number,
        presence: mediaType === 'audio' ? 'recording' : 'composing',
        delay: delay || 10000 // Tempo que ficará digitando em ms
      };

      const presenceResponse = await fetch(`${apiUrl}/chat/sendPresence/${encodeURIComponent(instanceName)}`, {
        method: 'POST',
        headers: {
          'apikey': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(presencePayload),
      });

      if (!presenceResponse.ok) {
        // Apenas ignora se a presence falhar, não impede o envio da mensagem
        console.warn('Falha ao enviar presence', await presenceResponse.text());
      }
      
      return NextResponse.json({ success: true, message: 'Presence enviada' });
    }

    // AÇÃO 2: Validar Número (Opcional)
    if (action === 'check') {
        const checkPayload = {
            numbers: [number]
        };
        const checkResponse = await fetch(`${apiUrl}/chat/whatsappNumbers/${encodeURIComponent(instanceName)}`, {
            method: 'POST',
            headers: {
              'apikey': apiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(checkPayload),
        });
        
        if (!checkResponse.ok) {
            return NextResponse.json({ exists: true, note: 'Check failed, assuming exists to attempt send' });
        }
        
        const checkData = await checkResponse.json();
        // A Evolution retorna um array com a flag exists, ou um objeto com validações
        const exists = Array.isArray(checkData) && checkData.length > 0 ? checkData[0]?.exists : true;
        return NextResponse.json({ exists, data: checkData });
    }

    // AÇÃO 3: Enviar Mensagem (Texto)
    if (action === 'sendText') {
      const sendPayload = {
        number: number,
        options: {
            delay: 0,
            presence: 'composing',
            linkPreview: true
        },
        textMessage: {
            text: message
        }
      };

      const sendResponse = await fetch(`${apiUrl}/message/sendText/${encodeURIComponent(instanceName)}`, {
        method: 'POST',
        headers: {
          'apikey': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sendPayload),
      });

      const responseData = await sendResponse.json();

      if (!sendResponse.ok) {
        return NextResponse.json(
          { error: 'Falha ao enviar mensagem', details: responseData },
          { status: sendResponse.status }
        );
      }

      return NextResponse.json({ success: true, data: responseData });
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });

  } catch (error: any) {
    console.error('Erro na rota de envio:', error);
    return NextResponse.json(
      { error: 'Erro interno', details: error?.message },
      { status: 500 }
    );
  }
}
