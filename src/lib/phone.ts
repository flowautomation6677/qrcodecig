/**
 * Normalizador e validador de telefones para formato brasileiro (E.164).
 */

export interface NormalizedPhoneResult {
  isValid: boolean;
  normalized: string; // Ex: "5561999998888"
  ddd: string;        // Ex: "61"
  raw: string;        // Número bruto original
  error?: string;
}

// Lista oficial de DDDs válidos do Brasil
export const VALID_BRAZIL_DDDS = new Set([
  '11', '12', '13', '14', '15', '16', '17', '18', '19', // SP
  '21', '22', '24',                                     // RJ
  '27', '28',                                           // ES
  '31', '32', '33', '34', '35', '37', '38',             // MG
  '41', '42', '43', '44', '45', '46',                   // PR
  '47', '48', '49',                                     // SC
  '51', '53', '54', '55',                               // RS
  '61',                                                 // DF
  '62', '64',                                           // GO
  '63',                                                 // TO
  '65', '66',                                           // MT
  '67',                                                 // MS
  '68',                                                 // AC
  '69',                                                 // RO
  '71', '73', '74', '75', '77',                         // BA
  '79',                                                 // SE
  '81', '87',                                           // PE
  '82',                                                 // AL
  '83',                                                 // PB
  '84',                                                 // RN
  '85', '88',                                           // CE
  '86', '89',                                           // PI
  '91', '93', '94',                                     // PA
  '92', '97',                                           // AM
  '95',                                                 // RR
  '96',                                                 // AP
  '98', '99',                                           // MA
]);

/**
 * Remove todos os caracteres não numéricos.
 */
export function cleanDigits(value: string | number | null | undefined): string {
  if (!value) return '';
  return String(value).replace(/\D/g, '');
}

/**
 * Normaliza um número de telefone brasileiro para o formato internacional:
 * 55 + DDD (2 dígitos) + Número (8 ou 9 dígitos)
 */
export function normalizeBrPhone(raw: string | number | null | undefined): NormalizedPhoneResult {
  const originalStr = raw !== null && raw !== undefined ? String(raw).trim() : '';
  let digits = cleanDigits(originalStr);

  if (!digits) {
    return { isValid: false, normalized: '', ddd: '', raw: originalStr, error: 'Número vazio' };
  }

  // Remove zero à esquerda (ex.: 061999998888 -> 61999998888)
  while (digits.startsWith('0')) {
    digits = digits.substring(1);
  }

  // Se já começar com o DDI do Brasil (55)
  if (digits.startsWith('55') && digits.length >= 12) {
    digits = digits.substring(2);
  }

  // Agora digits deve ser [DDD(2)] + [Número(8 ou 9)]
  if (digits.length < 10) {
    return {
      isValid: false,
      normalized: '',
      ddd: '',
      raw: originalStr,
      error: 'Telefone com poucos dígitos (deve conter DDD + 8 ou 9 dígitos)',
    };
  }

  if (digits.length > 11) {
    return {
      isValid: false,
      normalized: '',
      ddd: '',
      raw: originalStr,
      error: 'Telefone com excesso de dígitos',
    };
  }

  const ddd = digits.substring(0, 2);
  if (!VALID_BRAZIL_DDDS.has(ddd)) {
    return {
      isValid: false,
      normalized: '',
      ddd,
      raw: originalStr,
      error: `DDD "${ddd}" inválido no Brasil`,
    };
  }

  const subscriber = digits.substring(2);

  // Celulares no Brasil possuem 9 dígitos (começando com 9)
  // Fixos possuem 8 dígitos (começando com 2, 3, 4 ou 5)
  // Se for celular antigo de 8 dígitos (começando com 6, 7, 8 ou 9), ajusta inserindo 9
  let finalSubscriber = subscriber;
  if (finalSubscriber.length === 8 && ['6', '7', '8', '9'].includes(finalSubscriber[0])) {
    finalSubscriber = '9' + finalSubscriber;
  }

  if (finalSubscriber.length !== 8 && finalSubscriber.length !== 9) {
    return {
      isValid: false,
      normalized: '',
      ddd,
      raw: originalStr,
      error: 'Número do assinante deve ter 8 ou 9 dígitos',
    };
  }

  const normalized = `55${ddd}${finalSubscriber}`;

  return {
    isValid: true,
    normalized,
    ddd,
    raw: originalStr,
  };
}

/**
 * Valida se um número pertence a uma lista permitida de DDDs.
 * Se allowedDdds for nulo/vazio, aceita qualquer DDD válido.
 */
export function filterByDdd(ddd: string, allowedDdds?: string | string[] | null): boolean {
  if (!allowedDdds) return true;

  const dddList = Array.isArray(allowedDdds)
    ? allowedDdds.map((d) => d.trim().replace(/\D/g, ''))
    : allowedDdds
        .split(',')
        .map((d) => d.trim().replace(/\D/g, ''))
        .filter(Boolean);

  if (dddList.length === 0) return true;

  return dddList.includes(ddd);
}
