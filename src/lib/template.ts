/**
 * Motor de Templates, Personalização e Spintax.
 */

// Partículas e conectivos em português que não são capitalizados
const LOWERCASE_PARTICLES = new Set(['da', 'de', 'do', 'dos', 'das', 'e']);

// Títulos que podem ser detectados e preservados ou removidos
const TITLE_REGEX = /^(dr[a]?\.?|prof[a]?\.?|sr[a]?\.?)\s+/i;

/**
 * Converte uma palavra para Title Case ("ROSANI" -> "Rosani").
 */
export function capitalizeWord(word: string): string {
  if (!word) return '';
  const lower = word.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * Extrai e formata o primeiro nome com suporte a preservação/remoção de títulos.
 * Ex.: "DRA. ROSANI PINTO" -> keepTitles: false => "Rosani" | keepTitles: true => "Dra. Rosani"
 */
export function parseFirstName(rawName: string | null | undefined, keepTitles = false): string {
  if (!rawName) return '';
  const clean = String(rawName).trim().replace(/\s+/g, ' ');
  if (!clean) return '';

  const titleMatch = clean.match(TITLE_REGEX);
  let title = '';
  let rest = clean;

  if (titleMatch) {
    const rawTitle = titleMatch[1].toLowerCase();
    // Normaliza títulos comuns
    if (rawTitle.startsWith('dra')) title = 'Dra.';
    else if (rawTitle.startsWith('dr')) title = 'Dr.';
    else if (rawTitle.startsWith('profa')) title = 'Profa.';
    else if (rawTitle.startsWith('prof')) title = 'Prof.';
    else if (rawTitle.startsWith('sra')) title = 'Sra.';
    else if (rawTitle.startsWith('sr')) title = 'Sr.';
    else title = capitalizeWord(titleMatch[1]);

    rest = clean.slice(titleMatch[0].length).trim();
  }

  const parts = rest.split(' ').filter(Boolean);
  const firstName = parts[0] ? capitalizeWord(parts[0]) : '';

  if (!firstName) {
    return keepTitles && title ? title : '';
  }

  if (keepTitles && title) {
    return `${title} ${firstName}`;
  }

  return firstName;
}

/**
 * Formata um nome completo com regras de maiúsculas e minúsculas brasileiras.
 * Ex.: "ROSANI PINTO DA SILVA" -> "Rosani Pinto da Silva"
 */
export function formatFullName(rawName: string | null | undefined): string {
  if (!rawName) return '';
  const clean = String(rawName).trim().replace(/\s+/g, ' ');
  if (!clean) return '';

  return clean
    .split(' ')
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index > 0 && LOWERCASE_PARTICLES.has(lower)) {
        return lower;
      }
      return capitalizeWord(word);
    })
    .join(' ');
}

/**
 * Retorna a saudação dinâmica baseada no horário do fuso horário especificado.
 * 05:00 - 11:59: "Bom dia"
 * 12:00 - 17:59: "Boa tarde"
 * 18:00 - 04:59: "Boa noite"
 */
export function getGreeting(date = new Date(), timezone = 'America/Sao_Paulo'): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hourCycle: 'h23',
    });
    const hour = parseInt(formatter.format(date), 10);

    if (hour >= 5 && hour < 12) return 'Bom dia';
    if (hour >= 12 && hour < 18) return 'Boa tarde';
    return 'Boa noite';
  } catch {
    const utcHour = date.getUTCHours() - 3; // Fallback para UTC-3
    const hour = (utcHour + 24) % 24;
    if (hour >= 5 && hour < 12) return 'Bom dia';
    if (hour >= 12 && hour < 18) return 'Boa tarde';
    return 'Boa noite';
  }
}

/**
 * Resolve spintax no formato {opcao1|opcao2|opcao3}
 */
export function parseSpintax(text: string): string {
  if (!text) return '';
  let result = text;
  const spintaxRegex = /\{([^{}]+)\}/g;
  let match: RegExpExecArray | null;

  while ((match = spintaxRegex.exec(result)) !== null) {
    // Ignora se for uma variável legada de chave única sem pipe, ex {nome}
    if (!match[1].includes('|')) {
      continue;
    }
    const options = match[1].split('|');
    const chosen = options[Math.floor(Math.random() * options.length)].trim();
    result = result.replace(match[0], chosen);
    spintaxRegex.lastIndex = 0;
  }

  return result;
}

export interface TemplateContext {
  name?: string | null;
  phone?: string | null;
  variables?: Record<string, any>;
  now?: Date;
  timezone?: string;
  keepTitles?: boolean;
}

/**
 * Renderizador de template seguro com suporte a:
 * - {{primeiro_nome}} e {{primeiro_nome|fallback}}
 * - {{nome_completo}}
 * - {{saudacao}}
 * - {{variavel}} e {{variavel|fallback}} das colunas da planilha
 * - Spintax {Olá|Oi|Tudo bem}
 * - Compatibilidade retroativa com {nome}, {numero} e {variavel}
 */
export function renderTemplate(template: string, context: TemplateContext): string {
  if (!template) return '';

  const now = context.now || new Date();
  const timezone = context.timezone || 'America/Sao_Paulo';
  const greeting = getGreeting(now, timezone);
  const firstName = parseFirstName(context.name, context.keepTitles ?? false);
  const fullName = formatFullName(context.name);
  const phone = context.phone || '';

  // Cria um dicionário normalizado (minúsculo) com todas as variáveis disponíveis
  const varMap: Record<string, string> = {
    primeiro_nome: firstName,
    nome: firstName,
    nome_completo: fullName,
    saudacao: greeting,
    telefone: phone,
    numero: phone,
  };

  if (context.variables) {
    for (const [k, v] of Object.entries(context.variables)) {
      if (v !== undefined && v !== null) {
        varMap[k.toLowerCase().trim()] = String(v).trim();
      }
    }
  }

  let rendered = template;

  // 1. Processa {{variavel|fallback}} ou {{variavel}}
  rendered = rendered.replace(/\{\{([a-zA-Z0-9_]+)(?:\|([^}]+))?\}\}/g, (_, key, fallback) => {
    const normalizedKey = key.toLowerCase().trim();
    const val = varMap[normalizedKey];
    if (val && val.trim().length > 0) {
      return val.trim();
    }
    return fallback !== undefined ? fallback.trim() : '';
  });

  // 2. Processa variáveis simples com fallback {variavel|fallback}
  rendered = rendered.replace(/\{([a-zA-Z0-9_]+)\|([^{}|]+)\}/g, (match, key, fallback) => {
    const normalizedKey = key.toLowerCase().trim();
    if (varMap[normalizedKey] !== undefined) {
      const val = varMap[normalizedKey];
      if (val && val.trim().length > 0) {
        return val.trim();
      }
      return fallback.trim();
    }
    // Se a chave não tem valor no contexto, aplica o fallback
    return fallback.trim();
  });

  // 3. Processa variáveis simples sem fallback {variavel}
  rendered = rendered.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
    const normalizedKey = key.toLowerCase().trim();
    if (varMap[normalizedKey] !== undefined) {
      return varMap[normalizedKey] || '';
    }
    return match;
  });

  // 4. Resolve Spintax {opcao1|opcao2|...}
  rendered = parseSpintax(rendered);

  // 5. Limpa espaços antes de pontuação (ex.: "Olá , tudo bem" -> "Olá, tudo bem")
  rendered = rendered.replace(/\s+([,.:;!?])/g, '$1');

  // 6. Limpa espaços duplos e quebras de linha com espaços residuais
  rendered = rendered
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/^[ \t]+/gm, '')
    .trim();

  return rendered;
}
