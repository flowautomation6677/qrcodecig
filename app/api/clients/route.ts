import { NextResponse } from 'next/server';
import { prisma, ensureDatabaseSchema } from '@/src/lib/prisma';

export const dynamic = 'force-dynamic';

function slugify(text: string) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9]+/g, '-') // substitui caracteres especiais por traço
    .replace(/^-+|-+$/g, ''); // remove traços no início e fim
}

// GET /api/clients - Lista todos os clientes e atualiza o status de conexão ao vivo
export async function GET() {
  await ensureDatabaseSchema();
  const defaultInstance = process.env.EVOLUTION_INSTANCE_NAME || 'cigarroeletronico-atendimento';
  const defaultClientFallback = {
    id: 'cigarro-eletronico-default',
    name: 'Cigarro Eletrônico',
    slug: 'cigarro-eletronico',
    instanceName: defaultInstance,
    status: 'connected',
    createdAt: new Date().toISOString(),
    _count: { campaigns: 0 },
  };

  let clients: any[] = [];

  try {
    clients = await prisma.client.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { campaigns: true },
        },
      },
    });

    // Se nenhum cliente existir no banco, tenta auto-cadastrar o cliente atual
    if (clients.length === 0) {
      try {
        const defaultClient = await prisma.client.create({
          data: {
            name: 'Cigarro Eletrônico',
            slug: 'cigarro-eletronico',
            instanceName: defaultInstance,
            status: 'connected',
          },
        });

        // Tenta vincular campanhas legadas se houver
        try {
          await prisma.campaign.updateMany({
            where: { clientId: null },
            data: { clientId: defaultClient.id },
          });
        } catch {}

        clients = await prisma.client.findMany({
          orderBy: { createdAt: 'desc' },
          include: {
            _count: {
              select: { campaigns: true },
            },
          },
        });
      } catch (seedErr) {
        console.warn('Aviso ao criar cliente no banco, usando fallback:', seedErr);
        clients = [defaultClientFallback];
      }
    }
  } catch (dbErr) {
    console.warn('Banco indisponível ou sem tabela Client ainda, usando cliente ativo padrão:', dbErr);
    clients = [defaultClientFallback];
  }

  // Se por qualquer motivo a lista ainda estiver vazia, injeta o cliente ativo padrão
  if (!clients || clients.length === 0) {
    clients = [defaultClientFallback];
  }

  try {
    const apiUrl = process.env.EVOLUTION_API_URL?.replace(/\/$/, '');
    const apiKey = process.env.EVOLUTION_API_KEY;

    // Consulta status de cada instância na Evolution em paralelo com timeout seguro
    const clientsWithStatus = await Promise.all(
      clients.map(async (client) => {
        let liveStatus = client.status;

        if (apiUrl && apiKey && client.instanceName) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2500);

            const res = await fetch(
              `${apiUrl}/instance/connectionState/${encodeURIComponent(client.instanceName)}`,
              {
                method: 'GET',
                headers: {
                  apikey: apiKey,
                  'Content-Type': 'application/json',
                },
                cache: 'no-store',
                signal: controller.signal,
              }
            );
            clearTimeout(timeoutId);

            if (res.ok) {
              const data = await res.json();
              const state = data?.instance?.state || data?.state;
              if (state === 'open') {
                liveStatus = 'connected';
              } else if (state === 'connecting') {
                liveStatus = 'connecting';
              } else {
                liveStatus = 'disconnected';
              }
            } else {
              liveStatus = 'disconnected';
            }
          } catch {
            // Em caso de timeout ou erro de rede, mantém o último status
          }
        }

        return {
          ...client,
          status: liveStatus,
        };
      })
    );

    return NextResponse.json({ clients: clientsWithStatus });
  } catch (error: any) {
    console.error('Erro ao listar clientes, retornando fallback seguro:', error);
    return NextResponse.json({ clients: [defaultClientFallback] });
  }
}

// POST /api/clients - Cadastra novo cliente e cria a instância na Evolution API se necessário
export async function POST(req: Request) {
  try {
    await ensureDatabaseSchema();
    const body = await req.json();
    const { name, slug: customSlug, instanceName: customInstance } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Nome do cliente é obrigatório' }, { status: 400 });
    }

    const cleanName = name.trim();
    let slug = customSlug ? slugify(customSlug) : slugify(cleanName);
    if (!slug) slug = `cliente-${Date.now()}`;

    // Gera o nome da instância para a Evolution API (ex: cli_nomedocliente)
    let instanceName = customInstance
      ? customInstance.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_')
      : `cli_${slug.replace(/-/g, '_')}`;

    // Garante unicidade do slug se já existir
    const existingSlug = await prisma.client.findUnique({ where: { slug } });
    if (existingSlug) {
      slug = `${slug}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    // Garante unicidade da instanceName se já existir
    const existingInstance = await prisma.client.findUnique({ where: { instanceName } });
    if (existingInstance) {
      instanceName = `${instanceName}_${Math.floor(1000 + Math.random() * 9000)}`;
    }

    // Tenta auto-provisionar a instância na Evolution API
    const apiUrl = process.env.EVOLUTION_API_URL?.replace(/\/$/, '');
    const apiKey = process.env.EVOLUTION_API_KEY;

    if (apiUrl && apiKey) {
      try {
        await fetch(`${apiUrl}/instance/create`, {
          method: 'POST',
          headers: {
            apikey: apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            instanceName,
            qrcode: true,
            integration: 'WHATSAPP-BAILEYS',
          }),
        });
      } catch (evoErr) {
        console.warn('Aviso: Falha ao chamar /instance/create na Evolution (instância pode ser criada depois):', evoErr);
      }
    }

    const client = await prisma.client.create({
      data: {
        name: cleanName,
        slug,
        instanceName,
        status: 'disconnected',
      },
    });

    return NextResponse.json({ success: true, client });
  } catch (error: any) {
    console.error('Erro ao criar cliente:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
