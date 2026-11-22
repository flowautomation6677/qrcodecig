/**
 * Adaptador Oficial da Meta WhatsApp Cloud API (Graph API v21.0)
 * Suporte a envio de templates corporativos aprovados, mídias de cabeçalho e variáveis.
 */

export interface MetaCredentials {
  phoneNumberId: string;
  wabaId?: string | null;
  accessToken: string;
}

export interface MetaTemplateComponentParam {
  type: 'text' | 'image' | 'video' | 'document';
  text?: string;
  image?: { link: string };
  video?: { link: string };
  document?: { link: string; filename?: string };
}

export interface MetaTemplateComponent {
  type: 'header' | 'body' | 'button';
  sub_type?: 'url' | 'quick_reply';
  index?: string | number;
  parameters: MetaTemplateComponentParam[];
}

export interface SendMetaTemplateOptions {
  phoneNumberId: string;
  accessToken: string;
  to: string; // Ex: 5561999999999
  templateName: string;
  languageCode?: string; // Padrão: pt_BR
  headerType?: 'image' | 'video' | 'document' | 'text';
  headerUrl?: string | null;
  bodyParameters?: string[]; // Array de strings correspondentes a {{1}}, {{2}}, etc.
  buttonUrlSuffix?: string; // Para botões dinâmicos de URL
}

export interface MetaSendResult {
  ok: boolean;
  messageId?: string;
  status?: string;
  error?: string;
  rawData?: any;
}

const META_GRAPH_VERSION = 'v21.0';

/**
 * Valida a conexão com a Meta testando o Phone Number ID e o Access Token.
 */
export async function testMetaCredentials(credentials: MetaCredentials): Promise<{
  ok: boolean;
  verifiedName?: string;
  displayPhoneNumber?: string;
  qualityRating?: string;
  platformType?: string;
  error?: string;
}> {
  try {
    const { phoneNumberId, accessToken } = credentials;
    if (!phoneNumberId || !accessToken) {
      return { ok: false, error: 'Phone Number ID e Access Token são obrigatórios.' };
    }

    const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${phoneNumberId}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await res.json();
    if (!res.ok) {
      const msg = data.error?.message || `Erro da Meta HTTP ${res.status}`;
      return { ok: false, error: msg };
    }

    return {
      ok: true,
      verifiedName: data.verified_name || data.display_phone_number,
      displayPhoneNumber: data.display_phone_number,
      qualityRating: data.quality_rating,
      platformType: data.platform_type,
    };
  } catch (err: any) {
    return { ok: false, error: err.message || 'Falha de comunicação com a Meta.' };
  }
}

/**
 * Busca todos os templates aprovados cadastrados na WABA da cliente.
 */
export async function fetchMetaTemplates(wabaId: string, accessToken: string): Promise<{
  ok: boolean;
  templates?: any[];
  error?: string;
}> {
  try {
    if (!wabaId || !accessToken) {
      return { ok: false, error: 'WABA ID e Access Token são obrigatórios.' };
    }

    const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${wabaId}/message_templates?limit=100`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.error?.message || 'Falha ao buscar templates da Meta.' };
    }

    // Filtra apenas templates aprovados
    const approved = (data.data || []).filter((t: any) => t.status === 'APPROVED');

    return { ok: true, templates: approved };
  } catch (err: any) {
    return { ok: false, error: err.message || 'Erro ao conectar à API da Meta.' };
  }
}

/**
 * Dispara uma mensagem oficial utilizando um template aprovado.
 */
export async function sendMetaTemplateMessage(options: SendMetaTemplateOptions): Promise<MetaSendResult> {
  try {
    const {
      phoneNumberId,
      accessToken,
      to,
      templateName,
      languageCode = 'pt_BR',
      headerType,
      headerUrl,
      bodyParameters = [],
      buttonUrlSuffix,
    } = options;

    if (!phoneNumberId || !accessToken || !to || !templateName) {
      return { ok: false, error: 'Parâmetros incompletos para envio via Meta Cloud API.' };
    }

    // Normalização básica do telefone (apenas números)
    let cleanTo = String(to).replace(/\D/g, '');
    if (!cleanTo.startsWith('55') && (cleanTo.length === 10 || cleanTo.length === 11)) {
      cleanTo = '55' + cleanTo;
    }

    const components: MetaTemplateComponent[] = [];

    // 1. Componente de Cabeçalho (Header Media / Text)
    if (headerType && headerUrl) {
      if (headerType === 'video') {
        components.push({
          type: 'header',
          parameters: [{ type: 'video', video: { link: headerUrl } }],
        });
      } else if (headerType === 'image') {
        components.push({
          type: 'header',
          parameters: [{ type: 'image', image: { link: headerUrl } }],
        });
      } else if (headerType === 'document') {
        components.push({
          type: 'header',
          parameters: [{ type: 'document', document: { link: headerUrl } }],
        });
      } else if (headerType === 'text') {
        components.push({
          type: 'header',
          parameters: [{ type: 'text', text: headerUrl }],
        });
      }
    }

    // 2. Componente de Corpo (Body Text Parameters {{1}}, {{2}}, etc.)
    if (bodyParameters.length > 0) {
      components.push({
        type: 'body',
        parameters: bodyParameters.map((paramText) => ({
          type: 'text',
          text: String(paramText || ''),
        })),
      });
    }

    // 3. Componente de Botão de URL Dinâmico (se aplicável)
    if (buttonUrlSuffix) {
      components.push({
        type: 'button',
        sub_type: 'url',
        index: 0,
        parameters: [{ type: 'text', text: buttonUrlSuffix }],
      });
    }

    // Payload oficial exigido pela Meta Cloud API
    const payload: Record<string, any> = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanTo,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
      },
    };

    if (components.length > 0) {
      payload.template.components = components;
    }

    const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${phoneNumberId}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      const errDetail =
        data.error?.error_data?.details ||
        data.error?.message ||
        `Erro Meta HTTP ${res.status}`;
      return {
        ok: false,
        error: errDetail,
        rawData: data,
      };
    }

    const messageId = data.messages?.[0]?.id;
    const messageStatus = data.messages?.[0]?.message_status || 'accepted';

    return {
      ok: true,
      messageId,
      status: messageStatus,
      rawData: data,
    };
  } catch (err: any) {
    return {
      ok: false,
      error: err.message || 'Exceção ao disparar via Meta Cloud API.',
    };
  }
}
