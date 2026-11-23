import { describe, it } from 'node:test';
import assert from 'node:assert';
import { evaluateSchedule, type WindowConfig } from '../src/lib/schedule.ts';

describe('Schedule & Cadence Evaluator', () => {
  const windows: WindowConfig[] = [
    { start: '07:30', end: '09:00', limit: 12 },
    { start: '17:30', end: '19:30', limit: 12 },
  ];

  it('permite disparo dentro de janela ativa com cota disponível', () => {
    // 2026-11-23 (Segunda-feira), 08:00 em SP = 11:00 UTC
    const mondayMorning = new Date('2026-11-23T11:00:00Z');

    const res = evaluateSchedule(
      {
        timezone: 'America/Sao_Paulo',
        allowedDays: [1, 2, 3, 4, 5],
        windows,
        dailyLimit: 40,
      },
      {
        currentSlot: '2026-11-23#0',
        currentSlotCount: 5,
        todayDate: '2026-11-23',
        todayCount: 5,
      },
      mondayMorning
    );

    assert.strictEqual(res.canDispatch, true);
    assert.strictEqual(res.activeWindowIndex, 0);
    assert.strictEqual(res.slotKey, '2026-11-23#0');
    assert.strictEqual(res.currentSlotCount, 5);
  });

  it('bloqueia disparo quando atinge a cota da janela atual e agenda próximo slot', () => {
    // 2026-11-23 08:15 em SP = 11:15 UTC
    const mondayMorning = new Date('2026-11-23T11:15:00Z');

    const res = evaluateSchedule(
      {
        timezone: 'America/Sao_Paulo',
        allowedDays: [1, 2, 3, 4, 5],
        windows,
        dailyLimit: 40,
      },
      {
        currentSlot: '2026-11-23#0',
        currentSlotCount: 12, // Limite era 12
        todayDate: '2026-11-23',
        todayCount: 12,
      },
      mondayMorning
    );

    assert.strictEqual(res.canDispatch, false);
    assert.strictEqual(res.isWindowLimitReached, true);
    assert.ok(res.reason?.includes('Limite da janela atual atingido'));
    assert.ok(res.nextDispatchAt !== undefined);
    // Próxima janela deve abrir às 17:30 de hoje (20:30 UTC)
    assert.strictEqual(res.nextDispatchAt?.toISOString(), '2026-11-23T20:30:00.000Z');
  });

  it('bloqueia disparo quando atinge o limite diário e agenda para o próximo dia permitido', () => {
    // 2026-11-23 08:15 em SP
    const mondayMorning = new Date('2026-11-23T11:15:00Z');

    const res = evaluateSchedule(
      {
        timezone: 'America/Sao_Paulo',
        allowedDays: [1, 2, 3, 4, 5],
        windows,
        dailyLimit: 10,
      },
      {
        currentSlot: '2026-11-23#0',
        currentSlotCount: 5,
        todayDate: '2026-11-23',
        todayCount: 10, // Atingiu limite diário
      },
      mondayMorning
    );

    assert.strictEqual(res.canDispatch, false);
    assert.strictEqual(res.isDailyLimitReached, true);
    // Deve agendar para terça-feira às 07:30 (10:30 UTC)
    assert.strictEqual(res.nextDispatchAt?.toISOString(), '2026-11-24T10:30:00.000Z');
  });

  it('bloqueia disparo em dia não permitido (ex.: Domingo) e agenda para segunda-feira', () => {
    // 2026-11-22 (Domingo), 10:00 em SP = 13:00 UTC
    const sunday = new Date('2026-11-22T13:00:00Z');

    const res = evaluateSchedule(
      {
        timezone: 'America/Sao_Paulo',
        allowedDays: [1, 2, 3, 4, 5], // Seg a Sex
        windows,
      },
      {},
      sunday
    );

    assert.strictEqual(res.canDispatch, false);
    assert.strictEqual(res.isOutsideAllowedDays, true);
    // Deve agendar para segunda 2026-11-23 às 07:30 (10:30 UTC)
    assert.strictEqual(res.nextDispatchAt?.toISOString(), '2026-11-23T10:30:00.000Z');
  });

  it('bloqueia disparo fora das janelas (ex: às 12:00) e agenda para a próxima janela das 17:30', () => {
    // 2026-11-23 12:00 em SP = 15:00 UTC
    const mondayNoon = new Date('2026-11-23T15:00:00Z');

    const res = evaluateSchedule(
      {
        timezone: 'America/Sao_Paulo',
        allowedDays: [1, 2, 3, 4, 5],
        windows,
      },
      {},
      mondayNoon
    );

    assert.strictEqual(res.canDispatch, false);
    assert.strictEqual(res.isOutsideWindows, true);
    // Deve agendar para 17:30 de hoje (20:30 UTC)
    assert.strictEqual(res.nextDispatchAt?.toISOString(), '2026-11-23T20:30:00.000Z');
  });

  it('permite disparo no sábado quando configurado com finais de semana liberados', () => {
    // 2026-11-28 (Sábado), 08:30 em SP = 11:30 UTC
    const saturday = new Date('2026-11-28T11:30:00Z');

    const res = evaluateSchedule(
      {
        timezone: 'America/Sao_Paulo',
        allowedDays: [0, 1, 2, 3, 4, 5, 6], // Todos os dias incluindo Sábado e Domingo
        windows: [{ start: '08:00', end: '12:00', limit: 20 }],
      },
      {},
      saturday
    );

    assert.strictEqual(res.canDispatch, true);
    assert.strictEqual(res.isOutsideAllowedDays, false);
    assert.strictEqual(res.activeWindowIndex, 0);
  });

  it('permite disparo no domingo por padrão quando allowedDays não é especificado', () => {
    // 2026-11-22 (Domingo), 09:00 em SP = 12:00 UTC
    const sunday = new Date('2026-11-22T12:00:00Z');

    const res = evaluateSchedule(
      {
        timezone: 'America/Sao_Paulo',
        // Sem allowedDays especificado -> deve permitir todos os dias [0..6] por padrão
        windows: [{ start: '08:00', end: '12:00', limit: 20 }],
      },
      {},
      sunday
    );

    assert.strictEqual(res.canDispatch, true);
    assert.strictEqual(res.isOutsideAllowedDays, false);
    assert.strictEqual(res.activeWindowIndex, 0);
  });
});
