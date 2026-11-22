/**
 * Avaliador de Janelas de Horário, Cotas e Cadência no fuso America/Sao_Paulo.
 */

export interface WindowConfig {
  start: string; // "HH:mm" (ex: "07:30")
  end: string;   // "HH:mm" (ex: "09:00")
  limit: number; // Disparos máximos nesta janela (0 = sem limite específico)
}

export interface ScheduleConfig {
  timezone?: string;          // Padrão: "America/Sao_Paulo"
  allowedDays?: number[];      // [0..6] (0 = Domingo, 1 = Segunda, ... 6 = Sábado)
  windows?: WindowConfig[];    // Lista de janelas no mesmo dia
  dailyLimit?: number;         // Limite total diário (0 = sem limite)
}

export interface SlotStatus {
  currentSlot?: string | null;     // Ex: "2026-11-21#0"
  currentSlotCount?: number;       // Contador de envios no slot atual
  todayDate?: string | null;        // Ex: "2026-11-21"
  todayCount?: number;             // Contador de envios hoje
}

export interface ScheduleEvaluationResult {
  canDispatch: boolean;
  reason?: string;
  activeWindowIndex?: number;
  slotKey?: string;               // Ex: "2026-11-21#0"
  currentSlotCount: number;
  todayDate: string;              // Ex: "2026-11-21"
  todayCount: number;
  nextDispatchAt?: Date;          // Momento exato em que a próxima janela abre
  isOutsideAllowedDays: boolean;
  isOutsideWindows: boolean;
  isDailyLimitReached: boolean;
  isWindowLimitReached: boolean;
}

/**
 * Converte "HH:mm" para minutos desde o início do dia.
 */
export function timeStringToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Obtém os componentes da data atual no timezone indicado.
 */
export function getLocalTimeComponents(date: Date, timezone = 'America/Sao_Paulo') {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(date);
  const partMap: Record<string, string> = {};
  for (const p of parts) {
    partMap[p.type] = p.value;
  }

  const year = partMap.year;
  const month = partMap.month;
  const day = partMap.day;
  const hour = parseInt(partMap.hour, 10);
  const minute = parseInt(partMap.minute, 10);
  const second = parseInt(partMap.second, 10);

  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const dayOfWeek = weekdayMap[partMap.weekday] ?? 0;
  const dateStr = `${year}-${month}-${day}`;
  const minutesOfDay = hour * 60 + minute;

  return { year, month, day, hour, minute, second, dayOfWeek, dateStr, minutesOfDay };
}

/**
 * Converte um dia da semana + "HH:mm" no timezone alvo para uma Date UTC real.
 */
export function calculateNextWindowDate(
  baseDate: Date,
  targetDaysAhead: number,
  targetTimeStr: string,
  timezone = 'America/Sao_Paulo'
): Date {
  const comp = getLocalTimeComponents(baseDate, timezone);
  const [targetH, targetM] = targetTimeStr.split(':').map(Number);

  // Calcula a diferença em minutos
  const currentTotalMinutes = comp.minutesOfDay;
  const targetTotalMinutes = targetH * 60 + targetM;
  const minutesDiff = targetDaysAhead * 24 * 60 + (targetTotalMinutes - currentTotalMinutes);

  // Subtrai os segundos atuais para iniciar exatamente no segundo 0
  const targetMs = baseDate.getTime() + minutesDiff * 60 * 1000 - comp.second * 1000;
  return new Date(targetMs);
}

/**
 * Avalia o agendamento de uma campanha contra a data atual e as regras configuradas.
 */
export function evaluateSchedule(
  config: ScheduleConfig,
  currentStatus: SlotStatus = {},
  now = new Date()
): ScheduleEvaluationResult {
  const timezone = config.timezone || 'America/Sao_Paulo';
  const allowedDays = config.allowedDays && config.allowedDays.length > 0 ? config.allowedDays : [1, 2, 3, 4, 5];
  const windows = config.windows && config.windows.length > 0 ? config.windows : [{ start: '08:00', end: '18:00', limit: 0 }];
  const dailyLimit = config.dailyLimit || 0;

  const currentLocal = getLocalTimeComponents(now, timezone);
  const todayDate = currentLocal.dateStr;

  // Reset de contador diário se virou o dia
  let todayCount = currentStatus.todayCount || 0;
  if (currentStatus.todayDate !== todayDate) {
    todayCount = 0;
  }

  // Verifica se o dia de hoje é permitido
  const isAllowedDay = allowedDays.includes(currentLocal.dayOfWeek);

  // Função auxiliar para encontrar a próxima janela cronológica futura
  const findNextOpening = (): Date => {
    // Procura nos próximos 14 dias
    for (let dayOffset = 0; dayOffset <= 14; dayOffset++) {
      const checkDayOfWeek = (currentLocal.dayOfWeek + dayOffset) % 7;
      if (!allowedDays.includes(checkDayOfWeek)) {
        continue;
      }

      // Ordena janelas por horário de início
      const sortedWindows = [...windows].sort(
        (a, b) => timeStringToMinutes(a.start) - timeStringToMinutes(b.start)
      );

      for (const w of sortedWindows) {
        const startMin = timeStringToMinutes(w.start);
        // Se for hoje, só aceita janelas que ainda vão abrir no futuro
        if (dayOffset === 0 && startMin <= currentLocal.minutesOfDay) {
          continue;
        }

        return calculateNextWindowDate(now, dayOffset, w.start, timezone);
      }
    }

    // Fallback: amanhã às 08:00
    return calculateNextWindowDate(now, 1, '08:00', timezone);
  };

  // 1. Se hoje não é um dia permitido
  if (!isAllowedDay) {
    const nextDate = findNextOpening();
    return {
      canDispatch: false,
      reason: 'Hoje não é um dia da semana permitido para disparos',
      todayDate,
      todayCount,
      currentSlotCount: 0,
      nextDispatchAt: nextDate,
      isOutsideAllowedDays: true,
      isOutsideWindows: false,
      isDailyLimitReached: false,
      isWindowLimitReached: false,
    };
  }

  // 2. Se o limite diário foi atingido hoje
  if (dailyLimit > 0 && todayCount >= dailyLimit) {
    // Próxima janela deve ser no próximo dia permitido
    let nextAllowedDayOffset = 1;
    while (!allowedDays.includes((currentLocal.dayOfWeek + nextAllowedDayOffset) % 7)) {
      nextAllowedDayOffset++;
    }
    const firstWindowStart = [...windows].sort(
      (a, b) => timeStringToMinutes(a.start) - timeStringToMinutes(b.start)
    )[0]?.start || '08:00';

    const nextDate = calculateNextWindowDate(now, nextAllowedDayOffset, firstWindowStart, timezone);

    return {
      canDispatch: false,
      reason: `Limite diário atingido (${todayCount}/${dailyLimit})`,
      todayDate,
      todayCount,
      currentSlotCount: 0,
      nextDispatchAt: nextDate,
      isOutsideAllowedDays: false,
      isOutsideWindows: false,
      isDailyLimitReached: true,
      isWindowLimitReached: false,
    };
  }

  // 3. Procura se estamos dentro de alguma janela de horário agora
  let activeWindowIndex = -1;
  let activeWindow: WindowConfig | null = null;

  for (let i = 0; i < windows.length; i++) {
    const w = windows[i];
    const startMin = timeStringToMinutes(w.start);
    const endMin = timeStringToMinutes(w.end);

    if (currentLocal.minutesOfDay >= startMin && currentLocal.minutesOfDay < endMin) {
      activeWindowIndex = i;
      activeWindow = w;
      break;
    }
  }

  // 4. Se não estiver em nenhuma janela ativa
  if (activeWindowIndex === -1 || !activeWindow) {
    const nextDate = findNextOpening();
    return {
      canDispatch: false,
      reason: 'Fora do horário das janelas permitidas',
      todayDate,
      todayCount,
      currentSlotCount: 0,
      nextDispatchAt: nextDate,
      isOutsideAllowedDays: false,
      isOutsideWindows: true,
      isDailyLimitReached: false,
      isWindowLimitReached: false,
    };
  }

  // 5. Estamos em uma janela ativa! Avalia a cota do slot atual
  const slotKey = `${todayDate}#${activeWindowIndex}`;
  let currentSlotCount = 0;

  if (currentStatus.currentSlot === slotKey) {
    currentSlotCount = currentStatus.currentSlotCount || 0;
  }

  // Se a janela possui limite específico e já atingiu
  if (activeWindow.limit > 0 && currentSlotCount >= activeWindow.limit) {
    const nextDate = findNextOpening();
    return {
      canDispatch: false,
      reason: `Limite da janela atual atingido (${currentSlotCount}/${activeWindow.limit})`,
      activeWindowIndex,
      slotKey,
      todayDate,
      todayCount,
      currentSlotCount,
      nextDispatchAt: nextDate,
      isOutsideAllowedDays: false,
      isOutsideWindows: false,
      isDailyLimitReached: false,
      isWindowLimitReached: true,
    };
  }

  // 6. Janela aberta e com cota disponível para disparo imediato!
  return {
    canDispatch: true,
    activeWindowIndex,
    slotKey,
    todayDate,
    todayCount,
    currentSlotCount,
    isOutsideAllowedDays: false,
    isOutsideWindows: false,
    isDailyLimitReached: false,
    isWindowLimitReached: false,
  };
}
