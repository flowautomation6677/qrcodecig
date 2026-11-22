import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseFirstName, formatFullName, getGreeting, parseSpintax, renderTemplate } from '../src/lib/template.ts';

describe('Template Engine, Personalization & Spintax', () => {
  describe('parseFirstName', () => {
    it('extrai primeiro nome com Title Case de maiúsculas', () => {
      assert.strictEqual(parseFirstName('ROSANI PINTO'), 'Rosani');
      assert.strictEqual(parseFirstName('joão silva'), 'João');
      assert.strictEqual(parseFirstName('CARLOS EDUARDO'), 'Carlos');
    });

    it('remove títulos profissionais por padrão (keepTitles = false)', () => {
      assert.strictEqual(parseFirstName('DRA. ROSANI PINTO'), 'Rosani');
      assert.strictEqual(parseFirstName('Dr. Lucas Souza'), 'Lucas');
      assert.strictEqual(parseFirstName('profa maria santos'), 'Maria');
      assert.strictEqual(parseFirstName('SR. ROBERTO ALVES'), 'Roberto');
    });

    it('preserva títulos profissionais quando solicitado (keepTitles = true)', () => {
      assert.strictEqual(parseFirstName('DRA. ROSANI PINTO', true), 'Dra. Rosani');
      assert.strictEqual(parseFirstName('Dr Lucas Souza', true), 'Dr. Lucas');
      assert.strictEqual(parseFirstName('Profa. Maria Santos', true), 'Profa. Maria');
    });

    it('lida com nomes vazios ou com espaços excessivos', () => {
      assert.strictEqual(parseFirstName(''), '');
      assert.strictEqual(parseFirstName('   '), '');
      assert.strictEqual(parseFirstName('   ANA    BEATRIZ   '), 'Ana');
    });
  });

  describe('formatFullName', () => {
    it('formata nome completo respeitando partículas minúsculas', () => {
      assert.strictEqual(formatFullName('MARIA DA SILVA E SOUZA'), 'Maria da Silva e Souza');
      assert.strictEqual(formatFullName('LUCAS DE OLIVEIRA'), 'Lucas de Oliveira');
    });
  });

  describe('getGreeting', () => {
    it('retorna Bom dia entre 05h e 11h59 em SP', () => {
      const morning = new Date('2026-11-21T12:00:00Z');
      assert.strictEqual(getGreeting(morning, 'America/Sao_Paulo'), 'Bom dia');
    });

    it('retorna Boa tarde entre 12h e 17h59 em SP', () => {
      const afternoon = new Date('2026-11-21T17:00:00Z');
      assert.strictEqual(getGreeting(afternoon, 'America/Sao_Paulo'), 'Boa tarde');
    });

    it('retorna Boa noite a partir das 18h em SP', () => {
      const evening = new Date('2026-11-21T23:00:00Z');
      assert.strictEqual(getGreeting(evening, 'America/Sao_Paulo'), 'Boa noite');
    });
  });

  describe('parseSpintax', () => {
    it('resolve opções separadas por pipe {A|B}', () => {
      const text = '{Olá|Oi} tudo bem?';
      const parsed = parseSpintax(text);
      assert.ok(['Olá tudo bem?', 'Oi tudo bem?'].includes(parsed));
    });

    it('preserva textos sem spintax', () => {
      assert.strictEqual(parseSpintax('Texto comum sem variações'), 'Texto comum sem variações');
    });
  });

  describe('renderTemplate', () => {
    it('substitui variáveis com sucesso', () => {
      const tpl = '{{saudacao}}, {{primeiro_nome}}! Sua consulta em {{cidade}} está confirmada.';
      const res = renderTemplate(tpl, {
        name: 'DRA. BEATRIZ CARVALHO',
        variables: { cidade: 'Brasília' },
        now: new Date('2026-11-21T12:00:00Z'),
        keepTitles: false,
      });
      assert.strictEqual(res, 'Bom dia, Beatriz! Sua consulta em Brasília está confirmada.');
    });

    it('utiliza fallback quando o nome está vazio sem quebrar formatação nem colchetes', () => {
      const tpl = '{{saudacao}}, {{primeiro_nome|tudo bem}}? Como podemos ajudar?';
      const res = renderTemplate(tpl, {
        name: '',
        now: new Date('2026-11-21T12:00:00Z'),
      });
      assert.strictEqual(res, 'Bom dia, tudo bem? Como podemos ajudar?');
      assert.ok(!res.includes('{{'));
      assert.ok(!res.includes('}}'));
    });

    it('remove variável sem fallback graciosamente se não houver valor', () => {
      const tpl = 'Olá {{primeiro_nome}}, bem-vindo.';
      const res = renderTemplate(tpl, { name: null });
      assert.strictEqual(res, 'Olá, bem-vindo.');
    });

    it('funciona com variáveis legadas de chaves simples {nome}', () => {
      const tpl = 'Oi {nome}, tudo bem com sua empresa {empresa|local}?';
      const res = renderTemplate(tpl, {
        name: 'PEDRO HENRIQUE',
        variables: {},
      });
      assert.strictEqual(res, 'Oi Pedro, tudo bem com sua empresa local?');
    });
  });
});
