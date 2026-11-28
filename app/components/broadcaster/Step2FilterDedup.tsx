'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Filter, ShieldCheck, CheckCircle2, XCircle, AlertTriangle, 
  RotateCcw, ArrowRight, ArrowLeft, Users, RefreshCw, Hash, 
  Database, Search, Layers, UserCheck 
} from 'lucide-react';
import { BroadcasterFormData } from './types';

interface Props {
  formData: BroadcasterFormData;
  updateFormData: (updates: Partial<BroadcasterFormData>) => void;
  onNext: () => void;
  onBack: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning') => void;
}

export default function Step2FilterDedup({ formData, updateFormData, onNext, onBack, showToast }: Props) {
  const [loading, setLoading] = useState(false);
  const [tableSearch, setTableSearch] = useState('');

  // Executa análise no backend
  const runAnalysis = async () => {
    if (formData.phoneColumns.length === 0) {
      showToast('Selecione pelo menos uma coluna de telefone.', 'warning');
      return;
    }

    setLoading(true);
    try {
      let response: Response;

      if (formData.sheetFile) {
        const bodyFormData = new FormData();
        bodyFormData.append('file', formData.sheetFile);
        bodyFormData.append('nameColumn', formData.nameColumn);
        bodyFormData.append('phoneColumns', JSON.stringify(formData.phoneColumns));
        bodyFormData.append('extraColumns', JSON.stringify(formData.extraColumns));
        if (formData.selectedClientId) bodyFormData.append('clientId', formData.selectedClientId);
        if (formData.allowedDdds) bodyFormData.append('allowedDdds', formData.allowedDdds);
        bodyFormData.append('dedupDays', String(formData.dedupDays ?? 30));

        response = await fetch('/api/campaign/parse-sheet', {
          method: 'POST',
          body: bodyFormData,
        });
      } else {
        response = await fetch('/api/campaign/parse-sheet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rows: formData.allRows,
            nameColumn: formData.nameColumn,
            phoneColumns: formData.phoneColumns,
            extraColumns: formData.extraColumns,
            clientId: formData.selectedClientId || null,
            allowedDdds: formData.allowedDdds || null,
            dedupDays: Number(formData.dedupDays ?? 30),
          }),
        });
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao processar planilha no servidor');
      }

      updateFormData({
        summary: data.summary,
        sanitizedContacts: (data.contacts && Array.isArray(data.contacts) && data.contacts.length > 0) ? data.contacts : (data.preview || []),
      });

      const validCount = Number(data.summary?.validPhones ?? data.summary?.validNumbers ?? 0);
      showToast(
        `Higienização concluída: ${validCount.toLocaleString('pt-BR')} contatos válidos prontos!`,
        'success'
      );
    } catch (err: any) {
      console.error('Erro na análise:', err);
      showToast('Falha na higienização: ' + (err.message || 'Erro de comunicação'), 'error');
    } finally {
      setLoading(false);
    }
  };

  // Se ainda não foi analisado, roda automaticamente ao entrar
  useEffect(() => {
    if (!formData.summary && (formData.sheetFile || formData.allRows.length > 0)) {
      runAnalysis();
    }
  }, []);

  const handleProceed = () => {
    if (!formData.summary || (formData.sanitizedContacts?.length ?? 0) === 0) {
      showToast('Nenhum contato válido encontrado para disparo. Ajuste o filtro de DDD ou deduplicação.', 'warning');
      return;
    }
    onNext();
  };

  // Filtro de busca na tabela de preview
  const filteredPreview = useMemo(() => {
    const contactsList = formData.sanitizedContacts || [];
    if (!tableSearch) return contactsList.slice(0, 15);
    const search = tableSearch.toLowerCase();
    return contactsList.filter(
      (c) =>
        (c.name && c.name.toLowerCase().includes(search)) ||
        (c.normalizedPhone && c.normalizedPhone.includes(search)) ||
        (c.rawPhone && c.rawPhone.includes(search)) ||
        (c.contactGroupKey && c.contactGroupKey.toLowerCase().includes(search))
    ).slice(0, 30);
  }, [formData.sanitizedContacts, tableSearch]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Controles de Filtros & Regras */}
      <div className="bg-zinc-900/40 p-6 rounded-3xl border border-zinc-800/60 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-800/80 pb-4 gap-2">
          <div>
            <h4 className="text-base font-bold text-white flex items-center gap-2">
              <Filter className="w-4 h-4 text-emerald-400" />
              Regras de Filtragem de Região & Deduplicação
            </h4>
            <p className="text-xs text-zinc-400 mt-1">
              Filtre por DDD e evite disparos repetidos consultando o histórico no banco de dados.
            </p>
          </div>

          {formData.activeInstance && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/50 border border-zinc-800 text-xs">
              <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-zinc-400">Instância:</span>
              <span className="font-semibold text-emerald-300 font-mono">{formData.activeInstance}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Filtro por DDD */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-emerald-400" />
              Filtro por DDD (Opcional)
            </label>
            <input
              type="text"
              value={formData.allowedDdds}
              onChange={(e) => updateFormData({ allowedDdds: e.target.value })}
              placeholder="Ex: 61 ou 61, 62 (Vazio aceita todo o Brasil)"
              className="w-full bg-black/60 border border-zinc-700/60 rounded-xl p-3 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500/50"
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="text-[10px] text-zinc-500 self-center mr-1">Atalhos rápidos:</span>
              {[
                { label: 'DF (61)', val: '61' },
                { label: 'SP (11)', val: '11' },
                { label: 'RJ (21)', val: '21' },
                { label: 'MG (31)', val: '31' },
                { label: 'PR (41)', val: '41' },
                { label: 'BA (71)', val: '71' },
              ].map((item) => (
                <button
                  key={item.val}
                  type="button"
                  onClick={() => updateFormData({ allowedDdds: item.val })}
                  className={`text-[10px] px-2.5 py-1 rounded-lg border font-mono transition-colors cursor-pointer ${
                    formData.allowedDdds === item.val
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold'
                      : 'bg-zinc-800/60 border-zinc-700 text-zinc-400 hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
              {formData.allowedDdds && (
                <button
                  type="button"
                  onClick={() => updateFormData({ allowedDdds: '' })}
                  className="text-[10px] px-2.5 py-1 rounded-lg border border-zinc-700 text-zinc-400 hover:text-white cursor-pointer"
                >
                  Limpar (Todos)
                </button>
              )}
            </div>
          </div>

          {/* Deduplicação por Histórico do Cliente */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              Deduplicação por Histórico (Dias de Proteção)
            </label>
            <input
              type="number"
              min={0}
              max={365}
              value={formData.dedupDays}
              onChange={(e) => updateFormData({ dedupDays: Number(e.target.value) || 0 })}
              className="w-full bg-black/60 border border-zinc-700/60 rounded-xl p-3 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500/50"
            />
            <p className="text-[11px] text-zinc-500">
              Ignora contatos que já receberam disparos deste cliente nos últimos{' '}
              <strong className="text-zinc-300">{formData.dedupDays} dias</strong>. (Coloque 0 para desativar).
            </p>
          </div>
        </div>

        {/* Botão de Aplicar e Reanalisar */}
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={runAnalysis}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-emerald-400 font-semibold text-xs border border-zinc-700 hover:border-emerald-500/40 transition-all cursor-pointer disabled:opacity-50"
          >
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
            {loading ? 'Consultando histórico...' : 'Recalcular Filtros & Deduplicação'}
          </button>
        </div>
      </div>

      {/* Cartões de Resumo da Higienização */}
      {formData.summary && (
        <div className="space-y-4">
          <h4 className="text-sm font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-400" />
            Resultado da Higienização & Validação
          </h4>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800">
              <span className="text-[10px] uppercase font-bold text-zinc-500 block">Total Linhas</span>
              <p className="text-2xl font-light text-white mt-1">
                {Number(formData.summary?.totalRows ?? 0).toLocaleString('pt-BR')}
              </p>
            </div>

            <div className="bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800">
              <span className="text-[10px] uppercase font-bold text-zinc-500 block">Números Lidos</span>
              <p className="text-2xl font-light text-indigo-400 mt-1">
                {Number(formData.summary?.phonesFound ?? formData.summary?.totalNumbers ?? 0).toLocaleString('pt-BR')}
              </p>
            </div>

            <div className="bg-emerald-950/20 p-4 rounded-2xl border border-emerald-500/30">
              <span className="text-[10px] uppercase font-bold text-emerald-400 block flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Válidos p/ Disparo
              </span>
              <p className="text-2xl font-bold text-emerald-400 mt-1">
                {Number(formData.summary?.validPhones ?? formData.summary?.validNumbers ?? 0).toLocaleString('pt-BR')}
              </p>
            </div>

            <div className="bg-amber-950/20 p-4 rounded-2xl border border-amber-500/30">
              <span className="text-[10px] uppercase font-bold text-amber-400 block flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Descartados (DDD/Inv)
              </span>
              <p className="text-2xl font-bold text-amber-400 mt-1">
                {Number((formData.summary?.discardedDdd ?? 0) + (formData.summary?.discardedInvalid ?? 0)).toLocaleString('pt-BR')}
              </p>
            </div>

            <div className="bg-purple-950/20 p-4 rounded-2xl border border-purple-500/30">
              <span className="text-[10px] uppercase font-bold text-purple-400 block flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Já Disparados
              </span>
              <p className="text-2xl font-bold text-purple-400 mt-1">
                {Number(formData.summary?.ignoredDuplicates ?? formData.summary?.discardedDuplicate ?? 0).toLocaleString('pt-BR')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Lista de Contatos Higienizados com Busca */}
      {(formData.sanitizedContacts?.length ?? 0) > 0 && (
        <div className="bg-zinc-900/40 p-5 rounded-3xl border border-zinc-800/60 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-xs font-bold text-zinc-300 flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              Destinatários Válidos ({Number(formData.sanitizedContacts?.length ?? 0).toLocaleString('pt-BR')} prontos)
            </span>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-500" />
              <input
                type="text"
                placeholder="Buscar por telefone ou nome..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="bg-black/50 border border-zinc-700/60 rounded-xl pl-8 pr-3 py-1 text-xs text-zinc-200"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-black/50">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-zinc-900 text-zinc-400 uppercase text-[10px]">
                <tr>
                  <th className="px-3 py-2">Nome</th>
                  <th className="px-3 py-2">Telefone Normalizado (DDI 55)</th>
                  <th className="px-3 py-2">Telefone Original</th>
                  <th className="px-3 py-2">Chave de Agrupamento</th>
                  <th className="px-3 py-2">Variáveis Extras</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filteredPreview.map((c, i) => (
                  <tr key={i} className="hover:bg-zinc-800/20">
                    <td className="px-3 py-2 font-medium text-white">
                      {c.name || <span className="text-zinc-600">(sem nome)</span>}
                    </td>
                    <td className="px-3 py-2 font-mono text-emerald-400 font-bold">{c.normalizedPhone}</td>
                    <td className="px-3 py-2 font-mono text-zinc-500">{c.rawPhone}</td>
                    <td className="px-3 py-2 font-mono text-[11px] text-zinc-400">
                      <span className="bg-zinc-800 px-2 py-0.5 rounded text-zinc-300">
                        {c.contactGroupKey}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[11px] text-cyan-400">
                      {Object.keys(c.variables || {}).length > 0 ? (
                        JSON.stringify(c.variables)
                      ) : (
                        <span className="text-zinc-600">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Navegação */}
      <div className="flex items-center justify-between pt-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-sm transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>

        <button
          type="button"
          onClick={handleProceed}
          disabled={!formData.summary || (formData.sanitizedContacts?.length ?? 0) === 0}
          className="flex items-center gap-2 px-8 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20 cursor-pointer"
        >
          Avançar para Copy, Mídia & Preview Real
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
