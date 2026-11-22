export type MessageMode = 'text' | 'image' | 'audio' | 'video';

export interface TimeWindow {
  start: string; // "07:30"
  end: string;   // "09:00"
  limit: number; // 12
}

export interface ParsedContact {
  name?: string;
  rawPhone: string;
  normalizedPhone: string;
  contactGroupKey: string;
  variables: Record<string, any>;
}

export interface ParseSummary {
  totalRows: number;
  phonesFound: number;
  validPhones: number;
  discardedDdd: number;
  discardedInvalid: number;
  ignoredDuplicates: number;
}

export interface ClientItem {
  id: string;
  name: string;
  slug: string;
  instanceName: string;
  status: string;
}

export interface BroadcasterFormData {
  // Configs gerais
  campaignName: string;
  selectedClientId: string;
  activeInstance: string;

  // Planilha & Mapeamento
  sheetFile: File | null;
  fileName: string;
  headers: string[];
  rawRowsSample: Record<string, any>[];
  allRows: Record<string, any>[];
  totalRawRows: number;
  nameColumn: string;
  phoneColumns: string[];
  extraColumns: string[];

  // Higienização & Filtros
  allowedDdds: string;
  dedupDays: number;
  summary: ParseSummary | null;
  sanitizedContacts: ParsedContact[];

  // Mensagem & Mídia
  messageMode: MessageMode;
  messageTemplate: string;
  mediaBase64: string;
  mediaUrl: string;
  mediaFileName: string;
  isPtt: boolean;
  keepTitles: boolean;

  // Janelas & Cadência
  timezone: string;
  allowedDays: number[]; // [1, 2, 3, 4, 5]
  windows: TimeWindow[];
  dailyLimit: number;
  minDelaySec: number;
  maxDelaySec: number;
  validateWhatsApp: boolean;
  stopGroupOnSuccess: boolean;
  isScheduled: boolean;
  scheduledAt: string;
}
