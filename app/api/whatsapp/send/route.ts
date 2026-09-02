import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, number, message, instance, delay, mediaType, mediaUrl, mediaBase64, fileName, caption, isPtt } = body;

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
      const presenceType = mediaType === 'audio' ? 'recording' : 'composing';
      const presencePayload = {
        number: number,
        presence: presenceType,
        delay: delay || 5000 // Tempo de simulação em ms
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
        console.warn('Falha ao enviar presence', await presenceResponse.text());
      }
      
      return NextResponse.json({ success: true, message: 'Presence enviada', presence: presenceType });
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
        const exists = Array.isArray(checkData) && checkData.length > 0 ? checkData[0]?.exists : true;
        return NextResponse.json({ exists, data: checkData });
    }

    // AÇÃO 3: Enviar Mensagem de Texto Puro
    if (action === 'sendText') {
      const sendPayload = {
        number: number,
        text: message, // Compatibilidade com Evolution API v2
        options: {
            delay: 0,
            presence: 'composing',
            linkPreview: true
        },
        textMessage: { // Compatibilidade com Evolution API v1
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
          { error: 'Falha ao enviar mensagem de texto', details: responseData },
          { status: sendResponse.status }
        );
      }

      return NextResponse.json({ success: true, data: responseData });
    }

    // AÇÃO 4: Enviar Imagem / Mídia Genérica (sendMedia)
    if (action === 'sendMedia') {
      let mediaData = mediaBase64 || mediaUrl;
      
      if (mediaData && mediaData.startsWith('data:')) {
        // Remove o prefixo data:image/png;base64,
        mediaData = mediaData.substring(mediaData.indexOf(',') + 1);
      }

      if (!mediaData) {
        return NextResponse.json({ error: 'Nenhuma mídia fornecida (URL ou arquivo).' }, { status: 400 });
      }

      const mediaPayload = {
        number: number,
        mediatype: mediaType || 'image', // Evolution API v2
        media: mediaData, // Evolution API v2
        caption: caption || message || '', // Evolution API v2
        fileName: fileName || (mediaType === 'image' ? 'imagem.jpg' : 'arquivo'), // Evolution API v2
        options: {
          delay: 0,
          presence: 'composing'
        },
        mediaMessage: { // Evolution API v1
          mediatype: mediaType || 'image',
          caption: caption || message || '',
          media: mediaData,
          fileName: fileName || (mediaType === 'image' ? 'imagem.jpg' : 'arquivo')
        }
      };

      const sendResponse = await fetch(`${apiUrl}/message/sendMedia/${encodeURIComponent(instanceName)}`, {
        method: 'POST',
        headers: {
          'apikey': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mediaPayload),
      });

      const responseData = await sendResponse.json();

      if (!sendResponse.ok) {
        return NextResponse.json(
          { error: 'Falha ao enviar mídia', details: responseData },
          { status: sendResponse.status }
        );
      }

      return NextResponse.json({ success: true, data: responseData });
    }

    // AÇÃO 5: Enviar Áudio Gravado / PTT ou Arquivo de Áudio
    if (action === 'sendAudio') {
      let audioData = mediaBase64 || mediaUrl;
      
      if (audioData && audioData.startsWith('data:')) {
        audioData = audioData.substring(audioData.indexOf(',') + 1);
      }

      if (!audioData) {
        return NextResponse.json({ error: 'Nenhum áudio fornecido (gravação ou arquivo).' }, { status: 400 });
      }

      // Se for PTT (nota de voz gravada), usa sendWhatsAppAudio
      if (isPtt !== false) {
        const audioPayload = {
          number: number,
          audio: audioData, // Evolution API v2
          options: {
            delay: 0,
            presence: 'recording',
            encoding: true
          },
          audioMessage: { // Evolution API v1
            audio: audioData
          }
        };

        const sendResponse = await fetch(`${apiUrl}/message/sendWhatsAppAudio/${encodeURIComponent(instanceName)}`, {
          method: 'POST',
          headers: {
            'apikey': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(audioPayload),
        });

        const responseData = await sendResponse.json();

        if (!sendResponse.ok) {
          // Fallback para sendMedia se sendWhatsAppAudio falhar
          console.warn('Falha em sendWhatsAppAudio, tentando fallback para sendMedia...');
          const fallbackResponse = await fetch(`${apiUrl}/message/sendMedia/${encodeURIComponent(instanceName)}`, {
            method: 'POST',
            headers: {
              'apikey': apiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              number: number,
              mediatype: 'audio', // Evolution API v2
              media: audioData, // Evolution API v2
              fileName: fileName || 'audio.mp3', // Evolution API v2
              mediaMessage: { // Evolution API v1
                mediatype: 'audio',
                media: audioData,
                fileName: fileName || 'audio.mp3'
              }
            }),
          });
          
          if (!fallbackResponse.ok) {
            return NextResponse.json(
              { error: 'Falha ao enviar áudio', details: responseData },
              { status: sendResponse.status }
            );
          }
          return NextResponse.json({ success: true, data: await fallbackResponse.json() });
        }

        return NextResponse.json({ success: true, data: responseData });
      } else {
        // Enviar como arquivo de áudio padrão
        const mediaPayload = {
          number: number,
          mediatype: 'audio', // Evolution API v2
          media: audioData, // Evolution API v2
          caption: caption || '', // Evolution API v2
          fileName: fileName || 'audio.mp3', // Evolution API v2
          mediaMessage: { // Evolution API v1
            mediatype: 'audio',
            caption: caption || '',
            media: audioData,
            fileName: fileName || 'audio.mp3'
          }
        };

        const sendResponse = await fetch(`${apiUrl}/message/sendMedia/${encodeURIComponent(instanceName)}`, {
          method: 'POST',
          headers: {
            'apikey': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(mediaPayload),
        });

        const responseData = await sendResponse.json();
        if (!sendResponse.ok) {
          return NextResponse.json(
            { error: 'Falha ao enviar arquivo de áudio', details: responseData },
            { status: sendResponse.status }
          );
        }
        return NextResponse.json({ success: true, data: responseData });
      }
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
