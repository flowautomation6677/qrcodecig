'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Clock, Calendar, ShieldCheck, CheckCircle2, AlertTriangle, 
  Plus, Trash2, ArrowLeft, Play, Sparkles, Sliders, Smartphone, Check,
  Timer, Calculator, Zap
} from 'lucide-react';
import { BroadcasterFormData, TimeWindow } from './types';

interface Props {
  formData: BroadcasterFormData;
  updateFormData: (updates: Partial<BroadcasterFormData>) => void;
  onSubmit: () => void;
  onBack: () => void;
  loading: boolean;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning') => void;
}

const DAYS_OF_WEEK = [
  { id: 1, label: 'Seg' },
  { id: 2, label: 'Ter' },
  { id: 3, label: 'Qua' },
  { id: 4, label: 'Qui' },
  { id: 5, label: 'Sex' },
  { id: 6, label: 'Sáb' },
  { id: 0, label: 'Dom' },
];

export default function Step4CadenceSchedule({
  formData,
  updateFormData,
  onSubmit,
  onBack,
  loading,
  showToast,
}: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const isMeta = formData.provider === 'meta_official';
  const allowedDays = Array.isArray(formData.allowedDays) ? formData.allowedDays : [0, 1, 2, 3, 4, 5, 6];
  const windows = Array.isArray(formData.windows) ? formData.windows : [];

  // Alternar dia da semana
  const toggleDay = (dayId: number) => {
    const exists = allowedDays.includes(dayId);
    if (exists) {
      if (allowedDays.length === 1) {
        showToast('Pelo menos um dia da semana deve ser selecionado.', 'warning');
        return;
      }
      updateFormData({ allowedDays: allowedDays.filter((d) => d !== dayId) });
    } else {
      updateFormData({ allowedDays: [...allowedDays, dayId].sort((a, b) => a - b) });
    }
  };

  // Adicionar Janela
  const addWindow = () => {
    const newWindow: TimeWindow = {
      start: '08:00',
      end: '10:00',
      limit: 15,
    };
    updateFormData({ windows: [...windows, newWindow] });
  };

  // Remover Janela
  const removeWindow = (index: number) => {
    if (windows.length <= 1) {
      showToast('A campanha precisa de pelo menos uma janela de horário.', 'warning');
      return;
    }
    const updated = windows.filter((_, i) => i !== index);
    updateFormData({ windows: updated });
  };

  // Atualizar Janela
  const updateWindow = (index: number, updates: Partial<TimeWindow>) => {
    const updated = windows.map((w, i) => (i === index ? { ...w, ...updates } : w));
    updateFormData({ windows: updated });
  };

  // Aplicar Preset de Janelas
  const applyPreset = (preset: 'split' | 'full' | 'conservative' | 'meta_fast' | 'meta_balanced') => {
    if (preset === 'meta_fast') {
      updateFormData({
        windows: [{ start: '08:00', end: '19:00', limit: 0 }],
        dailyLimit: 0,
        minDelaySec: 2,
        maxDelaySec: 4,
      });
      showToast('Preset aplicado: Alta Performance Meta (2s a 4s por envio)', 'success');
    } else if (preset === 'meta_balanced') {
      updateFormData({
        windows: [{ start: '08:30', end: '18:30', limit: 0 }],
        dailyLimit: 0,
        minDelaySec: 5,
        maxDelaySec: 10,
      });
      showToast('Preset aplicado: Cadenciado Meta (5s a 10s por envio)', 'success');
    } else if (preset === 'split') {
      updateFormData({
        windows: [
          { start: '07:30', end: '09:00', limit: 12 },
          { start: '17:30', end: '19:30', limit: 12 },
        ],
        dailyLimit: 24,
        minDelaySec: isMeta ? 3 : 120,
        maxDelaySec: isMeta ? 6 : 240,
      });
      showToast('Preset aplicado: 2 Janelas (Manhã e Fim de Tarde)', 'success');
    } else if (preset === 'full') {
      updateFormData({
        windows: [{ start: '08:30', end: '18:00', limit: isMeta ? 0 : 40 }],
        dailyLimit: isMeta ? 0 : 40,
        minDelaySec: isMeta ? 3 : 90,
        maxDelaySec: isMeta ? 6 : 180,
      });
      showToast('Preset aplicado: Horário Comercial Contínuo (08:30 - 18:00)', 'success');
    } else {
      updateFormData({
        windows: [
          { start: '09:00', end: '11:00', limit: 8 },
          { start: '14:00', end: '16:00', limit: 8 },
        ],
        dailyLimit: 16,
        minDelaySec: 180,
        maxDelaySec: 360,
      });
      showToast('Preset aplicado: Ultra-Conservador anti-ban (chips novos)', 'success');
    }
  };

  // Verificação de alertas nas janelas
  const windowAlerts = useMemo(() => {
    const alerts: string[] = [];
    for (let i = 0; i < formData.windows.length; i++) {
      const w = formData.windows[i];
      if (w.start >= w.end) {
        alerts.push(`Janela #${i + 1}: o horário de início (${w.start}) deve ser anterior ao de término (${w.end}).`);
      }
    }
    const sumLimits = formData.windows.reduce((sum, w) => sum + (w.limit || 0), 0);
    if (formData.dailyLimit > 0 && sumLimits < formData.dailyLimit && formData.windows.length > 1) {
      alerts.push(`A soma das cotas das janelas (${sumLimits}) é menor que o limite diário (${formData.dailyLimit}).`);
    }
    return alerts;
  }, [formData.windows, formData.dailyLimit]);

  // Estimativa de dias para concluir a base inteira
  const simulation = useMemo(() => {
    const total = formData.sanitizedContacts.length;
    const daily = formData.dailyLimit > 0 ? formData.dailyLimit : 30;
    const daysAllowedPerWeek = Math.max(formData.allowedDays.length, 1);
    const totalOperationalDays = Math.ceil(total / daily);
    const weeksNeeded = (totalOperationalDays / daysAllowedPerWeek).toFixed(1);

    return {
      total,
      daily,
      daysAllowedPerWeek,
      totalOperationalDays,
      weeksNeeded,
    };
  }, [formData.sanitizedContacts.length, formData.dailyLimit, formData.allowedDays]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Configuração de Janelas & Horários */}
      <div className="bg-zinc-900/40 p-6 rounded-3xl border border-zinc-800/60 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-800/80 pb-4 gap-4">
          <div>
            <h4 className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              Janelas de Horário e Cota por Turno
            </h4>
            <p className="text-xs text-zinc-400 mt-1">
              O worker dispara exclusivamente dentro das janelas configuradas. Fora delas, pausa e aguarda a próxima janela.
            </p>
          </div>

          {/* Presets Rápidos */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] uppercase font-bold text-zinc-500 mr-1">Presets:</span>
            {isMeta ? (
              <>
                <button
                  type="button"
                  onClick={() => applyPreset('meta_fast')}
                  className="text-xs px-2.5 py-1 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-800/60 transition-colors cursor-pointer"
                >
                  ⚡ Alta Performance (2s - 4s)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('meta_balanced')}
                  className="text-xs px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-teal-300 border border-zinc-700 transition-colors cursor-pointer"
                >
                  Cadenciado Meta (5s - 10s)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('split')}
                  className="text-xs px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-colors cursor-pointer"
                >
                  2 Turnos
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => applyPreset('split')}
                  className="text-xs px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-emerald-300 border border-zinc-700 transition-colors cursor-pointer"
                >
                  2 Turnos (Manhã/Tarde)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('full')}
                  className="text-xs px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-colors cursor-pointer"
                >
                  Comercial Único
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('conservative')}
                  className="text-xs px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-purple-300 border border-zinc-700 transition-colors cursor-pointer"
                >
                  Chip Novo (Anti-Ban)
                </button>
              </>
            )}
          </div>
        </div>

        {/* Dias da Semana Permitidos */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              Dias da Semana Autorizados (Sábado e Domingo Permitidos)
            </label>
            {/* Atalhos rápidos de seleção de dias */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => updateFormData({ allowedDays: [0, 1, 2, 3, 4, 5, 6] })}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-emerald-400 font-semibold border border-zinc-700/80 transition-colors cursor-pointer"
              >
                Todos (Seg a Dom)
              </button>
              <button
                type="button"
                onClick={() => updateFormData({ allowedDays: [1, 2, 3, 4, 5, 6] })}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold border border-zinc-700/80 transition-colors cursor-pointer"
              >
                Seg a Sáb
              </button>
              <button
                type="button"
                onClick={() => updateFormData({ allowedDays: [1, 2, 3, 4, 5] })}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-semibold border border-zinc-700/80 transition-colors cursor-pointer"
              >
                Seg a Sex
              </button>
              <button
                type="button"
                onClick={() => updateFormData({ allowedDays: [0, 6] })}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-teal-300 font-semibold border border-zinc-700/80 transition-colors cursor-pointer"
              >
                Sáb e Dom
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {DAYS_OF_WEEK.map((d) => {
              const isSelected = allowedDays.includes(d.id);
              const isWeekend = d.id === 6 || d.id === 0;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => toggleDay(d.id)}
                  className={`w-14 h-11 rounded-xl text-xs font-bold transition-all border flex flex-col items-center justify-center cursor-pointer ${
                    isSelected
                      ? isWeekend
                        ? 'bg-teal-500/20 text-teal-300 border-teal-500/50 shadow-sm'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm'
                      : 'bg-black/40 text-zinc-500 border-zinc-800 hover:text-white'
                  }`}
                >
                  <span>{d.label}</span>
                  {isWeekend && (
                    <span className="text-[9px] font-normal opacity-75 leading-tight">fim sem.</span>
                  )}
                </button>
              );
            })}
          </div>
          {mounted && !allowedDays.includes(new Date().getDay()) ? (
            <p className="text-[11px] text-amber-400/90 flex items-center gap-1.5 mt-1 bg-amber-500/10 p-2 rounded-xl border border-amber-500/20">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>
                Hoje ({['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][new Date().getDay()]}) não está selecionado. Se deseja que os disparos aconteçam hoje, clique em "Todos (Seg a Dom)" ou marque o botão acima.
              </span>
            </p>
          ) : (
            <p className="text-[11px] text-zinc-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>
                Envios habilitados nos dias:{' '}
                <strong className="text-zinc-200">
                  {allowedDays.length === 7
                    ? 'Todos os dias da semana (incluindo Sábado e Domingo)'
                    : allowedDays
                        .map((id) => DAYS_OF_WEEK.find((d) => d.id === id)?.label)
                        .filter(Boolean)
                        .join(', ')}
                </strong>
              </span>
            </p>
          )}
        </div>

        {/* Lista de Janelas de Horário */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-300">
              Faixas de Horário e Cota por Janela (Fuso: America/Sao_Paulo)
            </span>
            <button
              type="button"
              onClick={addWindow}
              className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar Janela
            </button>
          </div>

          <div className="space-y-2">
            {windows.map((win, idx) => (
              <div
                key={idx}
                className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3.5 rounded-2xl bg-black/50 border border-zinc-800/80"
              >
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-zinc-800 text-zinc-300 text-xs font-bold flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <span className="text-xs text-zinc-400 font-medium">De:</span>
                  <input
                    type="time"
                    value={win.start}
                    onChange={(e) => updateWindow(idx, { start: e.target.value })}
                    className="bg-zinc-900 border border-zinc-700/80 rounded-lg px-2.5 py-1 text-xs text-white"
                  />
                  <span className="text-xs text-zinc-400 font-medium">Até:</span>
                  <input
                    type="time"
                    value={win.end}
                    onChange={(e) => updateWindow(idx, { end: e.target.value })}
                    className="bg-zinc-900 border border-zinc-700/80 rounded-lg px-2.5 py-1 text-xs text-white"
                  />
                </div>

                <div className="flex items-center gap-2 sm:ml-auto">
                  <span className="text-xs text-zinc-400">Cota da Janela:</span>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={win.limit}
                    onChange={(e) => updateWindow(idx, { limit: Number(e.target.value) || 1 })}
                    className="w-16 bg-zinc-900 border border-zinc-700/80 rounded-lg px-2 py-1 text-xs text-white text-center font-bold"
                  />
                  <span className="text-xs text-zinc-500">envios</span>

                  {formData.windows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeWindow(idx)}
                      className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors ml-2 cursor-pointer"
                      title="Remover janela"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Alertas de validação de horário */}
          {windowAlerts.length > 0 && (
            <div className="space-y-1 pt-1">
              {windowAlerts.map((alert, i) => (
                <p key={i} className="text-xs text-amber-400 flex items-center gap-1.5 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  {alert}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Limites e Delays Randômicos */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-zinc-800/80">
          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-1">
              Limite Diário Total (Envios/dia)
            </label>
            <input
              type="number"
              min={1}
              value={formData.dailyLimit}
              onChange={(e) => updateFormData({ dailyLimit: Number(e.target.value) || 1 })}
              className="w-full bg-black/60 border border-zinc-700/60 rounded-xl p-2.5 text-sm text-zinc-200"
            />
            <span className="text-[10px] text-zinc-500 block mt-1">
              Teto diário do chip para todas as janelas somadas.
            </span>
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-1">
              Delay Mínimo (segundos)
            </label>
            <input
              type="number"
              min={isMeta ? 1 : 15}
              value={formData.minDelaySec}
              onChange={(e) => updateFormData({ minDelaySec: Number(e.target.value) || (isMeta ? 2 : 15) })}
              className="w-full bg-black/60 border border-zinc-700/60 rounded-xl p-2.5 text-sm text-zinc-200"
            />
            <span className="text-[10px] text-zinc-500 block mt-1">
              {isMeta ? 'Ex.: 2s (API Oficial não sofre ban de chip).' : 'Ex.: 120s entre mensagens.'}
            </span>
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-1">
              Delay Máximo (segundos)
            </label>
            <input
              type="number"
              min={formData.minDelaySec}
              value={formData.maxDelaySec}
              onChange={(e) => updateFormData({ maxDelaySec: Number(e.target.value) || formData.minDelaySec })}
              className="w-full bg-black/60 border border-zinc-700/60 rounded-xl p-2.5 text-sm text-zinc-200"
            />
            <span className="text-[10px] text-zinc-500 block mt-1">
              {isMeta ? 'Ex.: 4s para ritmo acelerado.' : 'Intervalo randômico anti-ban.'}
            </span>
          </div>
        </div>

        {/* Regras Anti-Ban Evolution API & Resiliência */}
        <div className="space-y-3 pt-4 border-t border-zinc-800/80">
          <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Proteções Anti-Ban & Resiliência
          </span>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label
              className={`flex items-start gap-3 p-3.5 rounded-2xl bg-black/40 border border-zinc-800 ${
                isMeta ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-emerald-500/30'
              } transition-colors`}
            >
              <input
                type="checkbox"
                disabled={isMeta}
                checked={isMeta ? false : formData.validateWhatsApp}
                onChange={(e) => updateFormData({ validateWhatsApp: e.target.checked })}
                className="mt-0.5 rounded border-zinc-700 text-emerald-500 focus:ring-0"
              />
              <div>
                <span className="text-xs font-bold text-white block">Pré-validar WhatsApp no Envio</span>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  {isMeta
                    ? 'Desnecessário na API Oficial: a Meta valida em tempo real se o destinatário possui conta de WhatsApp.'
                    : 'Verifica se o número tem WhatsApp ativo antes de gastar a cota. Se não tiver, marca como Sem WhatsApp sem consumir limite e pula em 2s.'}
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-black/40 border border-zinc-800 cursor-pointer hover:border-emerald-500/30 transition-colors">
              <input
                type="checkbox"
                checked={formData.stopGroupOnSuccess}
                onChange={(e) => updateFormData({ stopGroupOnSuccess: e.target.checked })}
                className="mt-0.5 rounded border-zinc-700 text-emerald-500 focus:ring-0"
              />
              <div>
                <span className="text-xs font-bold text-white block">Parar Grupo após Primeiro Sucesso</span>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Se um mesmo contato possui vários telefones (Tel 1, Tel 2), interrompe os demais assim que 1 mensagem for entregue com sucesso.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Agendamento Opcional */}
        <div className="space-y-3 pt-4 border-t border-zinc-800/80">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-zinc-300">
              <input
                type="checkbox"
                checked={formData.isScheduled}
                onChange={(e) => updateFormData({ isScheduled: e.target.checked })}
                className="rounded border-zinc-700 text-purple-500 focus:ring-0"
              />
              <span>Agendar início para data/hora futura</span>
            </label>
          </div>

          {formData.isScheduled && (
            <input
              type="datetime-local"
              value={formData.scheduledAt}
              onChange={(e) => updateFormData({ scheduledAt: e.target.value })}
              className="bg-black/60 border border-zinc-700/60 rounded-xl p-3 text-sm text-zinc-200"
            />
          )}
        </div>
      </div>

      {/* Cartão de Simulação do Cronograma */}
      <div className="bg-zinc-900/60 p-5 rounded-3xl border border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h5 className="text-xs font-bold text-white uppercase tracking-wider">
              Estimativa de Execução da Campanha
            </h5>
            <p className="text-xs text-zinc-400 mt-0.5">
              {simulation.total.toLocaleString('pt-BR')} contatos • Limite de {simulation.daily} envios/dia em {simulation.daysAllowedPerWeek} dias/semana.
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-xs text-zinc-500 block">Tempo estimado:</span>
          <span className="text-lg font-extrabold text-emerald-400">
            ~{simulation.totalOperationalDays} dias úteis ({simulation.weeksNeeded} semanas)
          </span>
        </div>
      </div>

      {/* Resumo Final & Lançamento da Campanha */}
      <div className="bg-gradient-to-br from-emerald-950/30 to-zinc-900/60 p-6 rounded-3xl border border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div>
          <h4 className="text-base font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            Pronto para Iniciar Campanha Contínua
          </h4>
          <p className="text-xs text-zinc-300 mt-1 max-w-xl">
            {formData.sanitizedContacts.length.toLocaleString('pt-BR')} destinatários válidos serão processados de forma 100% autocontida{' '}
            {isMeta ? (
              <span>
                via <strong>API Oficial da Meta (Cloud API)</strong> com o template{' '}
                <strong className="text-cyan-400">{formData.metaTemplateName || 'template_kelly'}</strong>.
              </span>
            ) : (
              <span>
                pelo worker no chip <strong className="text-white">{formData.activeInstance}</strong>.
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={onBack}
            className="flex-1 sm:flex-none px-6 py-3.5 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-sm transition-all cursor-pointer"
          >
            Voltar
          </button>

          <button
            type="button"
            onClick={onSubmit}
            disabled={loading || windowAlerts.some((a) => a.includes('horário de início'))}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-sm transition-all shadow-xl shadow-emerald-500/25 disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <Play className="w-4 h-4 fill-black" />
            )}
            {formData.isScheduled ? 'Confirmar Agendamento' : 'Iniciar Campanha Agora'}
          </button>
        </div>
      </div>
    </div>
  );
}
