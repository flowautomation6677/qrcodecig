import { describe, it } from 'node:test';
import assert from 'node:assert';
import { normalizeBrPhone, filterByDdd } from '../src/lib/phone.ts';

describe('Phone Normalization & DDD Filter', () => {
  it('normaliza número celular com DDD e sem 55', () => {
    const res = normalizeBrPhone('(61) 99876-5432');
    assert.strictEqual(res.isValid, true);
    assert.strictEqual(res.normalized, '5561998765432');
    assert.strictEqual(res.ddd, '61');
  });

  it('normaliza número já com 55 e formatação', () => {
    const res = normalizeBrPhone('+55 (11) 98765-4321');
    assert.strictEqual(res.isValid, true);
    assert.strictEqual(res.normalized, '5511987654321');
    assert.strictEqual(res.ddd, '11');
  });

  it('normaliza número com zero à esquerda', () => {
    const res = normalizeBrPhone('061998765432');
    assert.strictEqual(res.isValid, true);
    assert.strictEqual(res.normalized, '5561998765432');
  });

  it('normaliza telefone fixo de 8 dígitos', () => {
    const res = normalizeBrPhone('6133445566');
    assert.strictEqual(res.isValid, true);
    assert.strictEqual(res.normalized, '556133445566');
    assert.strictEqual(res.ddd, '61');
  });

  it('adiciona 9 para celular antigo de 8 dígitos que inicia com 9, 8, 7 ou 6', () => {
    const res = normalizeBrPhone('6188765432');
    assert.strictEqual(res.isValid, true);
    assert.strictEqual(res.normalized, '5561988765432');
  });

  it('rejeita DDD inexistente no Brasil', () => {
    const res = normalizeBrPhone('20999998888');
    assert.strictEqual(res.isValid, false);
    assert.ok(res.error?.includes('DDD "20" inválido'));
  });

  it('rejeita número sem DDD com poucos dígitos', () => {
    const res = normalizeBrPhone('999998888');
    assert.strictEqual(res.isValid, false);
    assert.ok(res.error?.includes('poucos dígitos'));
  });

  it('rejeita número vazio', () => {
    const res = normalizeBrPhone('');
    assert.strictEqual(res.isValid, false);
    assert.strictEqual(res.error, 'Número vazio');
  });

  it('filtra corretamente por DDD', () => {
    assert.strictEqual(filterByDdd('61', '61,62'), true);
    assert.strictEqual(filterByDdd('62', '61,62'), true);
    assert.strictEqual(filterByDdd('11', '61,62'), false);
    assert.strictEqual(filterByDdd('61', null), true);
    assert.strictEqual(filterByDdd('61', ''), true);
    assert.strictEqual(filterByDdd('61', ['61', '62']), true);
  });
});
