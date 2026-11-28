'use client';

import React, { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { 
  Upload, FileSpreadsheet, Check, AlertCircle, Phone, 
  User, Tag, Sparkles, FileText, Search, Plus, Layers 
} from 'lucide-react';
import { BroadcasterFormData } from './types';

interface Props {
  formData: BroadcasterFormData;
  updateFormData: (updates: Partial<BroadcasterFormData>) => void;
  onNext: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning') => void;
}

export default function Step1Upload({ formData, updateFormData, onNext, showToast }: Props) {
  const [inputTab, setInputTab] = useState<'upload' | 'paste'>('upload');
  const [pasteText, setPasteText] = useState('');
  const [columnSearch, setColumnSearch] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Processa arquivo .xlsx, .xls ou .csv
  const processFile = async (file: File) => {
    setParsing(true);
    try {
      const fileName = file.name;
      const lower = fileName.toLowerCase();

      let headers: string[] = [];
      let rows: Record<string, any>[] = [];

      if (lower.endsWith('.csv') || lower.endsWith('.txt')) {
        const text = await file.text();
        const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
        headers = (parsed.meta.fields || []).map((h) => h.trim()).filter(Boolean);
        rows = (parsed.data as Record<string, any>[]).filter((r) =>
          Object.values(r).some((v) => String(v).trim())
        );
      } else if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' }) as Record<string, any>[];
        if (rows.length > 0) {
          headers = Object.keys(rows[0]).map((h) => h.trim()).filter(Boolean);
        }
      } else {
        showToast('Formato não suportado. Envie um arquivo .xlsx, .xls ou .csv', 'warning');
        setParsing(false);
        return;
      }

      if (rows.length === 0 || headers.length === 0) {
        showToast('A planilha enviada parece estar vazia ou sem cabeçalhos válidos.', 'warning');
        setParsing(false);
        return;
      }

      detectAndSetColumns(fileName, file, headers, rows);
      showToast(`Planilha carregada: ${(rows?.length ?? 0).toLocaleString('pt-BR')} linhas detectadas!`, 'success');
    } catch (err: any) {
      console.error('Erro ao ler planilha:', err);
      showToast('Falha ao processar o arquivo: ' + (err.message || 'Erro desconhecido'), 'error');
    } finally {
      setParsing(false);
    }
  };

  // Processa texto colado manualmente
  const processPastedText = () => {
    if (!pasteText.trim()) {
      showToast('Cole o conteúdo no campo de texto antes de continuar.', 'warning');
      return;
    }

    setParsing(true);
    try {
      // Tenta parsing como CSV/TSV
      const parsed = Papa.parse(pasteText.trim(), { header: true, skipEmptyLines: true });
      let headers: string[] = [];
      let rows: Record<string, any>[] = [];

      if (parsed.meta.fields && parsed.meta.fields.length > 1) {
        headers = parsed.meta.fields.map((h) => h.trim()).filter(Boolean);
        rows = (parsed.data as Record<string, any>[]).filter((r) =>
          Object.values(r).some((v) => String(v).trim())
        );
      } else {
        // Se não tem cabeçalho detectado, interpreta linhas simples "numero,nome" ou "numero"
        const lines = pasteText.split('\n').map((l) => l.trim()).filter(Boolean);
        headers = ['Telefone', 'Nome'];
        rows = lines.map((line) => {
          const parts = line.split(/[,;\t]/).map((p) => p.trim());
          return {
            Telefone: parts[0] || '',
            Nome: parts[1] || '',
          };
        });
      }

      if (rows.length === 0) {
        showToast('Nenhuma linha de contato válida encontrada no texto.', 'warning');
        setParsing(false);
        return;
      }

      detectAndSetColumns('Lista Colada Manualmente', null, headers, rows);
      showToast(`Lista processada: ${rows.length} contatos detectados!`, 'success');
    } catch (err: any) {
      showToast('Erro ao processar texto: ' + err.message, 'error');
    } finally {
      setParsing(false);
    }
  };

  // Auto-detecção de colunas
  const detectAndSetColumns = (
    fileName: string,
    file: File | null,
    headers: string[],
    rows: Record<string, any>[]
  ) => {
    // 1. Detectar Coluna de Nome
    let detectedNameCol = '';
    const nameKeywords = ['nome', 'name', 'cliente', 'contato', 'paciente', 'pessoa', 'titular'];
    for (const h of headers) {
      if (nameKeywords.some((k) => h.toLowerCase().includes(k))) {
        detectedNameCol = h;
        break;
      }
    }

    // 2. Detectar Colunas de Telefone (pode ser múltiplas: Tel 1, Tel 2, Celular, etc.)
    const phoneKeywords = ['tel', 'cel', 'fone', 'phone', 'whats', 'whatsapp', 'numero', 'número'];
    const detectedPhoneCols: string[] = [];
    for (const h of headers) {
      if (phoneKeywords.some((k) => h.toLowerCase().includes(k))) {
        detectedPhoneCols.push(h);
      }
    }

    // Se nenhuma coluna casou com telefone, seleciona a primeira que não seja nome
    if (detectedPhoneCols.length === 0 && headers.length > 0) {
      const fallback = headers.find((h) => h !== detectedNameCol) || headers[0];
      detectedPhoneCols.push(fallback);
    }

    // 3. Colunas Extras (para variáveis)
    const detectedExtraCols = headers.filter(
      (h) => h !== detectedNameCol && !detectedPhoneCols.includes(h)
    );

    updateFormData({
      sheetFile: file,
      fileName,
      headers,
      allRows: rows,
      rawRowsSample: rows.slice(0, 5),
      totalRawRows: rows.length,
      nameColumn: detectedNameCol || '',
      phoneColumns: detectedPhoneCols,
      extraColumns: detectedExtraCols.slice(0, 5),
      summary: null,
      sanitizedContacts: [],
    });
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const togglePhoneColumn = (col: string) => {
    const exists = formData.phoneColumns.includes(col);
    if (exists) {
      if (formData.phoneColumns.length === 1) {
        showToast('Pelo menos uma coluna de telefone deve estar selecionada.', 'warning');
        return;
      }
      updateFormData({
        phoneColumns: formData.phoneColumns.filter((c) => c !== col),
        summary: null,
        sanitizedContacts: [],
      });
    } else {
      updateFormData({
        phoneColumns: [...formData.phoneColumns, col],
        summary: null,
        sanitizedContacts: [],
      });
    }
  };

  const toggleExtraColumn = (col: string) => {
    const exists = formData.extraColumns.includes(col);
    if (exists) {
      updateFormData({
        extraColumns: formData.extraColumns.filter((c) => c !== col),
        summary: null,
        sanitizedContacts: [],
      });
    } else {
      updateFormData({
        extraColumns: [...formData.extraColumns, col],
        summary: null,
        sanitizedContacts: [],
      });
    }
  };

  const handleProceed = () => {
    if (formData.totalRawRows === 0) {
      showToast('Faça o upload ou cole os contatos antes de continuar.', 'warning');
      return;
    }
    if (formData.phoneColumns.length === 0) {
      showToast('Selecione pelo menos uma coluna de telefone.', 'warning');
      return;
    }
    onNext();
  };

  const filteredHeaders = useMemo(() => {
    if (!columnSearch) return formData.headers;
    return formData.headers.filter((h) => h.toLowerCase().includes(columnSearch.toLowerCase()));
  }, [formData.headers, columnSearch]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Abas: Upload vs Colar Texto */}
      <div className="flex items-center gap-2 p-1 bg-zinc-900/60 rounded-2xl border border-zinc-800 w-fit">
        <button
          type="button"
          onClick={() => setInputTab('upload')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            inputTab === 'upload'
              ? 'bg-emerald-500 text-black shadow-md'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          Subir Planilha (.xlsx, .xls, .csv)
        </button>

        <button
          type="button"
          onClick={() => setInputTab('paste')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            inputTab === 'paste'
              ? 'bg-emerald-500 text-black shadow-md'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          Colar Lista Manual
        </button>
      </div>

      {/* Conteúdo Aba Upload */}
      {inputTab === 'upload' && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleFileDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-200 group ${
            isDragging
              ? 'border-emerald-500 bg-emerald-500/10'
              : 'border-zinc-700/60 hover:border-emerald-500/50 bg-zinc-900/30 hover:bg-zinc-900/50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,.txt"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) processFile(file);
            }}
            className="hidden"
          />

          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform shadow-lg shadow-emerald-500/10">
              {parsing ? (
                <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <FileSpreadsheet className="w-8 h-8" />
              )}
            </div>

            <div>
              <h3 className="text-lg font-bold text-white mb-1">
                {formData.fileName ? formData.fileName : 'Arraste sua planilha ou clique para selecionar'}
              </h3>
              <p className="text-sm text-zinc-400">
                Suporta planilhas completas em formato <span className="text-emerald-400 font-mono">.xlsx</span>,{' '}
                <span className="text-emerald-400 font-mono">.xls</span> ou{' '}
                <span className="text-emerald-400 font-mono">.csv</span>
              </p>
            </div>

            {(formData.totalRawRows ?? 0) > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                <Check className="w-3.5 h-3.5" />
                {Number(formData.totalRawRows ?? 0).toLocaleString('pt-BR')} linhas carregadas
              </div>
            )}
          </div>
        </div>
      )}

      {/* Conteúdo Aba Colar Manual */}
      {inputTab === 'paste' && (
        <div className="bg-zinc-900/40 p-6 rounded-3xl border border-zinc-800/60 space-y-4">
          <label className="text-xs font-semibold text-zinc-300 block">
            Cole contatos no formato CSV ou linhas simples:
          </label>
          <textarea
            rows={6}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="5561999999999,João Silva,Brasília&#10;5561888888888,Maria Santos,Taguatinga&#10;5511777777777,Carlos Souza,São Paulo"
            className="w-full bg-black/60 border border-zinc-700/60 rounded-2xl p-4 text-xs font-mono text-zinc-200 focus:outline-none focus:border-emerald-500/50"
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={processPastedText}
              disabled={parsing || !pasteText.trim()}
              className="px-6 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-emerald-400 border border-emerald-500/30 font-bold text-xs transition-all disabled:opacity-40 cursor-pointer"
            >
              {parsing ? 'Processando...' : 'Carregar Contatos'}
            </button>
          </div>
        </div>
      )}

      {/* Mapeamento de Colunas */}
      {formData.headers.length > 0 && (
        <div className="bg-zinc-900/40 p-6 rounded-3xl border border-zinc-800/60 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-800/80 pb-4 gap-3">
            <div>
              <h4 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                Mapeamento Inteligente de Colunas
              </h4>
              <p className="text-xs text-zinc-400 mt-1">
                Vincule as colunas da sua planilha ao motor de higienização e personalização.
              </p>
            </div>

            {formData.headers.length > 6 && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Buscar coluna..."
                  value={columnSearch}
                  onChange={(e) => setColumnSearch(e.target.value)}
                  className="bg-black/50 border border-zinc-700/60 rounded-xl pl-8 pr-3 py-1 text-xs text-zinc-200"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Coluna de Nome */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-emerald-400" />
                Coluna de Nome (Opcional)
              </label>
              <select
                value={formData.nameColumn}
                onChange={(e) => updateFormData({ nameColumn: e.target.value, summary: null, sanitizedContacts: [] })}
                className="w-full bg-black/60 border border-zinc-700/60 rounded-xl p-3 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500/50 cursor-pointer"
              >
                <option value="">(Sem coluna de nome - disparar sem nome)</option>
                {formData.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-zinc-500">
                Usado para gerar <span className="text-emerald-400 font-mono">{'{{primeiro_nome}}'}</span> e{' '}
                <span className="text-emerald-400 font-mono">{'{{nome_completo}}'}</span> com Title Case.
              </p>
            </div>

            {/* Colunas de Telefone (1 ou Múltiplas) */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-emerald-400" />
                  Colunas de Telefone * (1 ou múltiplas)
                </span>
                <span className="text-[11px] text-emerald-400 font-semibold">
                  {formData.phoneColumns.length} coluna(s) ativa(s)
                </span>
              </label>
              <div className="bg-black/40 border border-zinc-800 rounded-xl p-3 max-h-40 overflow-y-auto space-y-1.5">
                {filteredHeaders.map((h) => {
                  const isChecked = formData.phoneColumns.includes(h);
                  return (
                    <label
                      key={h}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs transition-colors ${
                        isChecked
                          ? 'bg-emerald-500/10 text-emerald-300 font-medium'
                          : 'hover:bg-zinc-800/40 text-zinc-400'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => togglePhoneColumn(h)}
                          className="rounded border-zinc-700 text-emerald-500 focus:ring-0 bg-zinc-900"
                        />
                        <span>{h}</span>
                      </span>
                      {isChecked && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono">
                          Agrupado
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
              <p className="text-[11px] text-zinc-500">
                Selecione todas as colunas com telefones (ex.: <code className="text-zinc-400">Tel 1</code>,{' '}
                <code className="text-zinc-400">Tel 2</code>). Todos os números do mesmo contato serão agrupados sob{' '}
                <code className="text-zinc-400 font-mono">contactGroupKey</code>.
              </p>
            </div>
          </div>

          {/* Colunas Extras para Variáveis na Copy */}
          <div className="space-y-2 pt-2 border-t border-zinc-800/80">
            <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-cyan-400" />
                Colunas Extras para Variáveis Dinâmicas na Copy (Opcional)
              </span>
              <span className="text-[11px] text-zinc-400">{formData.extraColumns.length} selecionada(s)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {formData.headers
                .filter((h) => h !== formData.nameColumn && !formData.phoneColumns.includes(h))
                .map((h) => {
                  const isSelected = formData.extraColumns.includes(h);
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => toggleExtraColumn(h)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-all flex items-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                          : 'bg-zinc-800/60 text-zinc-400 hover:text-white border border-zinc-700/40'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 text-cyan-400" />}
                      {'{{' + h + '}}'}
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Amostra dos Dados */}
          {formData.rawRowsSample.length > 0 && (
            <div className="pt-2 border-t border-zinc-800/80">
              <span className="text-xs font-semibold text-zinc-400 block mb-2">
                Amostra das primeiras linhas lidas:
              </span>
              <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-black/50">
                <table className="w-full text-left text-xs text-zinc-300">
                  <thead className="bg-zinc-900/90 text-zinc-400 font-semibold uppercase text-[10px]">
                    <tr>
                      {formData.headers.map((h) => (
                        <th key={h} className="px-3 py-2 whitespace-nowrap">
                          {h}
                          {h === formData.nameColumn && ' (Nome)'}
                          {formData.phoneColumns.includes(h) && ' (Tel)'}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {formData.rawRowsSample.map((row, idx) => (
                      <tr key={idx} className="hover:bg-zinc-800/30">
                        {formData.headers.map((h) => (
                          <td key={h} className="px-3 py-2 whitespace-nowrap text-zinc-300 font-mono text-[11px]">
                            {String(row[h] || '-')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Ação Próximo Passo */}
      <div className="flex justify-end pt-4">
        <button
          type="button"
          onClick={handleProceed}
          disabled={formData.totalRawRows === 0 || formData.phoneColumns.length === 0}
          className="flex items-center gap-2 px-8 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20 cursor-pointer"
        >
          Avançar para Filtros & Deduplicação
        </button>
      </div>
    </div>
  );
}
