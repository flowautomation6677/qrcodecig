'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  CheckCircle2, XCircle, AlertTriangle, Users, 
  FileSpreadsheet, Filter, MessageSquare, Clock, ArrowRight 
} from 'lucide-react';
import { BroadcasterFormData, ClientItem } from './broadcaster/types';
import Step1Upload from './broadcaster/Step1Upload';
import Step2FilterDedup from './broadcaster/Step2FilterDedup';
import Step3MessagePreview from './broadcaster/Step3MessagePreview';
import Step4CadenceSchedule from './broadcaster/Step4CadenceSchedule';

const STEPS = [
  { id: 1, title: 'Upload & Mapeamento', icon: FileSpreadsheet },
  { id: 2, title: 'Filtros & Deduplicação', icon: Filter },
  { id: 3, title: 'Copy, Mídia & Preview', icon: MessageSquare },
  { id: 4, title: 'Janelas & Cadência', icon: Clock },
];

export default function Broadcaster({ instanceName }: Readonly<{ instanceName: string }>) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClientId = searchParams?.get('clientId') || null;

  const [currentStep, setCurrentStep] = useState(1);
  const [clientsList, setClientsList] = useState<ClientItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  // Estado unificado do Wizard
  const [formData, setFormData] = useState<BroadcasterFormData>({
    campaignName: 'Campanha ' + new Date().toLocaleDateString('pt-BR'),
    selectedClientId: queryClientId || '',
    activeInstance: instanceName,
    provider: 'evolution',

    // Configs API Oficial da Meta
    metaTemplateName: 'template_kelly',
    metaTemplateLanguage: 'pt_BR',
    metaTemplateComponents: [],
    metaHeaderUrl: '',
    metaHeaderType: 'video',

    sheetFile: null,
    fileName: '',
    headers: [],
    rawRowsSample: [],
    allRows: [],
    totalRawRows: 0,
    nameColumn: '',
    phoneColumns: [],
    extraColumns: [],

    allowedDdds: '',
    dedupDays: 30,
    summary: null,
    sanitizedContacts: [],

    messageMode: 'text',
    messageTemplate: 'Olá {{primeiro_nome|tudo bem}}, {{saudacao}}!\n\n{Aqui é|Fala com} o time da Flowrocket.',
    mediaBase64: '',
    mediaUrl: '',
    mediaFileName: '',
    isPtt: true,
    keepTitles: false,

    timezone: 'America/Sao_Paulo',
    allowedDays: [0, 1, 2, 3, 4, 5, 6], // Seg a Dom (todos os dias, incluindo finais de semana)
    windows: [
      { start: '07:30', end: '09:00', limit: 12 },
      { start: '17:30', end: '19:30', limit: 12 },
    ],
    dailyLimit: 24,
    minDelaySec: 120,
    maxDelaySec: 240,
    validateWhatsApp: true,
    stopGroupOnSuccess: true,
    isScheduled: false,
    scheduledAt: '',
  });

  const updateFormData = (updates: Partial<BroadcasterFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  // Carregar lista de clientes para seleção de remetente
  useEffect(() => {
    fetch('/api/clients')
      .then((res) => res.json())
      .then((data) => {
        if (data.clients && data.clients.length > 0) {
          setClientsList(data.clients);
          if (queryClientId) {
            const found = data.clients.find((c: any) => c.id === queryClientId);
            if (found) {
              const isMeta = found.provider === 'meta_official';
              setFormData((prev) => ({
                ...prev,
                selectedClientId: found.id,
                activeInstance: found.instanceName,
                provider: isMeta ? 'meta_official' : 'evolution',
                validateWhatsApp: isMeta ? false : prev.validateWhatsApp,
                minDelaySec: isMeta ? 2 : prev.minDelaySec,
                maxDelaySec: isMeta ? 5 : prev.maxDelaySec,
              }));
              return;
            }
          }
          if (!formData.activeInstance && data.clients[0]) {
            const first = data.clients[0];
            const isMeta = first.provider === 'meta_official';
            setFormData((prev) => ({
              ...prev,
              selectedClientId: first.id,
              activeInstance: first.instanceName,
              provider: isMeta ? 'meta_official' : 'evolution',
              validateWhatsApp: isMeta ? false : prev.validateWhatsApp,
              minDelaySec: isMeta ? 2 : prev.minDelaySec,
              maxDelaySec: isMeta ? 5 : prev.maxDelaySec,
            }));
          }
        }
      })
      .catch((err) => console.error('Erro ao carregar clientes:', err));
  }, [queryClientId]);

  const handleClientChange = (clientId: string) => {
    const client = clientsList.find((c) => c.id === clientId);
    const isMeta = client?.provider === 'meta_official';
    setFormData((prev) => ({
      ...prev,
      selectedClientId: clientId,
      activeInstance: client ? client.instanceName : prev.activeInstance,
      provider: isMeta ? 'meta_official' : 'evolution',
      validateWhatsApp: isMeta ? false : prev.validateWhatsApp,
      minDelaySec: isMeta ? 2 : prev.minDelaySec,
      maxDelaySec: isMeta ? 5 : prev.maxDelaySec,
      summary: null, // força nova deduplicação pelo novo cliente
    }));
  };

  // Submissão Final
  const handleSubmitCampaign = async () => {
    if (!formData.activeInstance) {
      showToast('Selecione um cliente / instância conectada para disparar.', 'warning');
      return;
    }

    if (formData.sanitizedContacts.length === 0) {
      showToast('Nenhum contato válido para disparo.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: formData.campaignName,
        clientId: formData.selectedClientId || undefined,
        instanceName: formData.activeInstance,
        messageMode: formData.messageMode,
        messageTemplate: formData.messageTemplate,
        mediaBase64: formData.mediaBase64 || undefined,
        mediaUrl: formData.mediaUrl || undefined,
        fileName: formData.mediaFileName || undefined,
        isPtt: formData.isPtt,
        keepTitles: formData.keepTitles,
        delayMin: formData.minDelaySec,
        delayMax: formData.maxDelaySec,
        timezone: formData.timezone,
        allowedDays: formData.allowedDays,
        windowsJson: formData.windows,
        dailyLimit: formData.dailyLimit,
        validateWhatsApp: formData.validateWhatsApp,
        stopGroupOnSuccess: formData.stopGroupOnSuccess,
        dedupDays: formData.dedupDays,
        allowedDdds: formData.allowedDdds || undefined,
        // Parâmetros Meta Cloud API
        provider: formData.provider,
        metaTemplateName: formData.provider === 'meta_official' ? formData.metaTemplateName : undefined,
        metaTemplateLanguage: formData.provider === 'meta_official' ? formData.metaTemplateLanguage : undefined,
        metaTemplateComponents: formData.provider === 'meta_official' ? formData.metaTemplateComponents : undefined,
        scheduledAt: formData.isScheduled && formData.scheduledAt ? new Date(formData.scheduledAt).toISOString() : undefined,
        contacts: formData.sanitizedContacts.map((c) => ({
          number: c.normalizedPhone,
          normalizedPhone: c.normalizedPhone,
          name: c.name,
          contactGroupKey: c.contactGroupKey,
          variables: c.variables,
        })),
      };

      const res = await fetch('/api/campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao criar campanha no servidor');
      }

      showToast('Campanha contínua criada com sucesso!', 'success');
      router.push(`/disparador/campanha/${data.campaignId}`);
    } catch (err: any) {
      console.error(err);
      showToast('Erro ao criar campanha: ' + (err.message || 'Falha de comunicação'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-emerald-500/30">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 flex items-start gap-3 px-6 py-4 rounded-2xl shadow-2xl border transition-all animate-in fade-in slide-in-from-top-4 duration-300 max-w-md ${
            toast.type === 'error'
              ? 'bg-red-500/10 border-red-500/20 text-red-400 backdrop-blur-md'
              : toast.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 backdrop-blur-md'
              : 'bg-amber-500/10 border-amber-500/20 text-amber-400 backdrop-blur-md'
          }`}
        >
          <div className="mt-0.5">
            {toast.type === 'error' && <XCircle className="w-5 h-5" />}
            {toast.type === 'success' && <CheckCircle2 className="w-5 h-5" />}
            {toast.type === 'warning' && <AlertTriangle className="w-5 h-5" />}
          </div>
          <span className="font-medium text-sm flex-1 whitespace-pre-wrap">{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-2 opacity-50 hover:opacity-100 transition-opacity cursor-pointer"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8">
        
        {/* Header Geral da Campanha */}
        <header className="flex flex-col md:flex-row md:items-end justify-between border-b border-zinc-800/80 pb-6 mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-200">
              Criar Campanha Contínua
            </h1>
            <p className="text-zinc-400 mt-2 text-sm max-w-xl">
              Plataforma 100% autocontida com importação única de planilha, deduplicação em banco, pré-validação de WhatsApp e cadência por janelas.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Seletor de Cliente */}
            <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-2xl px-3 py-2">
              <span className="text-xs font-semibold text-zinc-400">Cliente:</span>
              <select
                value={formData.selectedClientId}
                onChange={(e) => handleClientChange(e.target.value)}
                className="bg-transparent text-sm font-semibold text-emerald-400 focus:outline-none cursor-pointer"
              >
                <option value="">Selecione o Cliente</option>
                {clientsList.map((c) => (
                  <option key={c.id} value={c.id} className="bg-zinc-900 text-white">
                    {c.provider === 'meta_official' ? '⚡ ' : '📱 '}{c.name}
                  </option>
                ))}
              </select>
              {formData.provider === 'meta_official' && (
                <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  Meta Oficial
                </span>
              )}
            </div>

            {/* Nome da Campanha */}
            <input
              type="text"
              value={formData.campaignName}
              onChange={(e) => updateFormData({ campaignName: e.target.value })}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500/50"
              placeholder="Nome da Campanha"
            />
          </div>
        </header>

        {/* Barra de Progresso do Wizard (4 Etapas) */}
        <nav aria-label="Progresso" className="mb-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {STEPS.map((step) => {
              const StepIcon = step.icon;
              const isActive = currentStep === step.id;
              const isPast = currentStep > step.id;

              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => {
                    // Só permite pular se já tiver planilha ou estiver voltando
                    if (isPast || (step.id === 2 && formData.totalRawRows > 0) || (step.id === 3 && formData.sanitizedContacts.length > 0)) {
                      setCurrentStep(step.id);
                    }
                  }}
                  className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-all text-left cursor-pointer ${
                    isActive
                      ? 'bg-emerald-500/10 border-emerald-500/50 text-white shadow-lg shadow-emerald-500/10'
                      : isPast
                      ? 'bg-zinc-900/60 border-zinc-800 text-emerald-400 hover:border-zinc-700'
                      : 'bg-zinc-900/20 border-zinc-800/40 text-zinc-500 opacity-60'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold ${
                      isActive
                        ? 'bg-emerald-500 text-black'
                        : isPast
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-zinc-800 text-zinc-500'
                    }`}
                  >
                    {isPast ? '✓' : step.id}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase font-bold text-zinc-500 block truncate">
                      Etapa {step.id}
                    </span>
                    <span className="text-xs font-bold block truncate text-zinc-200">
                      {step.title}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Conteúdo Dinâmico por Etapa */}
        {currentStep === 1 && (
          <Step1Upload
            formData={formData}
            updateFormData={updateFormData}
            onNext={() => setCurrentStep(2)}
            showToast={showToast}
          />
        )}

        {currentStep === 2 && (
          <Step2FilterDedup
            formData={formData}
            updateFormData={updateFormData}
            onNext={() => setCurrentStep(3)}
            onBack={() => setCurrentStep(1)}
            showToast={showToast}
          />
        )}

        {currentStep === 3 && (
          <Step3MessagePreview
            formData={formData}
            updateFormData={updateFormData}
            onNext={() => setCurrentStep(4)}
            onBack={() => setCurrentStep(2)}
            showToast={showToast}
          />
        )}

        {currentStep === 4 && (
          <Step4CadenceSchedule
            formData={formData}
            updateFormData={updateFormData}
            onSubmit={handleSubmitCampaign}
            onBack={() => setCurrentStep(3)}
            loading={submitting}
            showToast={showToast}
          />
        )}

      </div>
    </div>
  );
}
