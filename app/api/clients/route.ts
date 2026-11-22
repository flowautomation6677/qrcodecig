import { NextResponse } from 'next/server';
import { prisma, ensureDatabaseSchema } from '@/src/lib/prisma';
import { testMetaCredentials } from '@/src/lib/providers/meta';

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

const DEFAULT_KELLY = {
  name: 'Kelly Veloso (Sônia Imóveis)',
  slug: 'kelly-veloso',
  instanceName: 'meta_kelly_veloso',
  provider: 'meta_official',
  metaPhoneNumberId: '849870041539834',
  metaWabaId: '2671775253166341',
  metaAccessToken: 'EAAq2T9ZBAJGQBS8IM9FSn1NR3w35MZAECqZBTD3O5bR9hk2aYZCQZCRf03dI49RGYoejAqPaSPUtAPlLYLu6uuDEi9m9lJ1F8VL7bZBkl7kZAg2NWeQWBwCI1Lhx19H2hHak7Oq9ep8Tm6dKSkZBFZCJZCd3XD86CzQRPq1qyPeVQeAZCJMYD93VjMNjasQzsryCAZDZD',
  status: 'connected',
};

// GET /api/clients - Lista todos os clientes e atualiza o status de conexão ao vivo
export async function GET() {
  await ensureDatabaseSchema();
  const defaultInstance = process.env.EVOLUTION_INSTANCE_NAME || 'cigarroeletronico-atendimento';
  const defaultClientFallback = {
    id: 'cigarro-eletronico-default',
    name: 'Cigarro Eletrônico',
    slug: 'cigarro-eletronico',
    instanceName: defaultInstance,
    provider: 'evolution',
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

    // Auto-seed cliente Kelly se ainda não existir
    const hasKelly = clients.some(
      (c) => c.slug === 'kelly-veloso' || c.metaPhoneNumberId === DEFAULT_KELLY.metaPhoneNumberId
    );
    if (!hasKelly) {
      try {
        await prisma.client.create({
          data: DEFAULT_KELLY,
        });
        clients = await prisma.client.findMany({
          orderBy: { createdAt: 'desc' },
          include: {
            _count: {
              select: { campaigns: true },
            },
          },
        });
      } catch (kellySeedErr) {
        console.warn('Aviso ao auto-cadastrar cliente Kelly:', kellySeedErr);
      }
    }

    // Se nenhum cliente existir no banco, tenta auto-cadastrar o cliente padrão
    if (clients.length === 0) {
      try {
        const defaultClient = await prisma.client.create({
          data: {
            name: 'Cigarro Eletrônico',
            slug: 'cigarro-eletronico',
            instanceName: defaultInstance,
            provider: 'evolution',
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

    // Consulta status de cada instância na Evolution apenas para clientes 'evolution'
    const clientsWithStatus = await Promise.all(
      clients.map(async (client) => {
        // Se for cliente da API Oficial da Meta, a conexão é perene e direta na nuvem
        if (client.provider === 'meta_official') {
          return {
            ...client,
            status: 'connected',
          };
        }

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

// POST /api/clients - Cadastra novo cliente (Evolution ou Meta Official)
export async function POST(req: Request) {
  try {
    await ensureDatabaseSchema();
    const body = await req.json();
    const {
      name,
      slug: customSlug,
      instanceName: customInstance,
      provider = 'evolution',
      metaPhoneNumberId,
      metaWabaId,
      metaAccessToken,
    } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Nome do cliente é obrigatório' }, { status: 400 });
    }

    const cleanName = name.trim();
    let slug = customSlug ? slugify(customSlug) : slugify(cleanName);
    if (!slug) slug = `cliente-${Date.now()}`;

    // Garante unicidade do slug se já existir
    const existingSlug = await prisma.client.findUnique({ where: { slug } });
    if (existingSlug) {
      slug = `${slug}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    // Rota 1: Cliente da API Oficial da Meta
    if (provider === 'meta_official') {
      if (!metaPhoneNumberId || !metaAccessToken) {
        return NextResponse.json(
          { error: 'Phone Number ID e Access Token são obrigatórios para conexão oficial Meta.' },
          { status: 400 }
        );
      }

      // Validação das credenciais diretamente com a Meta Graph API
      const testResult = await testMetaCredentials({
        phoneNumberId: metaPhoneNumberId.trim(),
        accessToken: metaAccessToken.trim(),
      });

      if (!testResult.ok) {
        return NextResponse.json(
          { error: `Credenciais Meta inválidas: ${testResult.error}` },
          { status: 400 }
        );
      }

      let instanceName = customInstance
        ? customInstance.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_')
        : `meta_${metaPhoneNumberId.trim()}`;

      const existingInstance = await prisma.client.findUnique({ where: { instanceName } });
      if (existingInstance) {
        instanceName = `${instanceName}_${Math.floor(1000 + Math.random() * 9000)}`;
      }

      const client = await prisma.client.create({
        data: {
          name: cleanName,
          slug,
          instanceName,
          provider: 'meta_official',
          metaPhoneNumberId: metaPhoneNumberId.trim(),
          metaWabaId: metaWabaId?.trim() || null,
          metaAccessToken: metaAccessToken.trim(),
          status: 'connected',
        },
      });

      return NextResponse.json({ success: true, client });
    }

    // Rota 2: Cliente Tradicional com Chip WhatsApp (Evolution API / Baileys)
    let instanceName = customInstance
      ? customInstance.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_')
      : `cli_${slug.replace(/-/g, '_')}`;

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
        provider: 'evolution',
        status: 'disconnected',
      },
    });

    return NextResponse.json({ success: true, client });
  } catch (error: any) {
    console.error('Erro ao criar cliente:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
