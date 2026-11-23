'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, CheckCircle2, Clock, PlayCircle, XCircle, 
  Save, AlertTriangle, Users, Calendar, Settings, Trash2, 
  PauseCircle, Download, Edit3, Smartphone, ShieldCheck, 
  RefreshCw, Check, Search, Filter, Hash, Eye, Volume2, Video, 
  ImageIcon, Plus, ExternalLink, Zap
} from 'lucide-react';

interface TimeWindow {
  start: string;
  end: string;
  limit: number;
}

export default function CampanhaDetailsPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [campaign, setCampaign] = useState<any>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros na tabela de contatos
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal de Edição Rápida
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editTemplate, setEditTemplate] = useState('');
  const [editMediaUrl, setEditMediaUrl] = useState('');
  const [editDelayMin, setEditDelayMin] = useState(120);
  const [editDelayMax, setEditDelayMax] = useState(240);
  const [editDailyLimit, setEditDailyLimit] = useState(24);
  const [editWindows, setEditWindows] = useState<TimeWindow[]>([]);
  const [editAllowedDays, setEditAllowedDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [editValidateWhatsApp, setEditValidateWhatsApp] = useState(true);
  const [editStopGroup, setEditStopGroup] = useState(true);

  const [saving, setSaving] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'warning') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchCampaign = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch(`/api/campaign/${params.id}`);
      const data = await res.json();
      if (data.campaign) {
        setCampaign(data.campaign);
        setContacts(data.contacts || []);
        
        // Inicializar form de edição
        if (showLoading) {
          setEditName(data.campaign.name || '');
          setEditTemplate(data.campaign.messageTemplate || '');
          setEditMediaUrl(data.campaign.mediaUrl || '');
          setEditDelayMin(data.campaign.delayMin || 120);
          setEditDelayMax(data.campaign.delayMax || 240);
          setEditDailyLimit(data.campaign.dailyLimit || 24);
          setEditValidateWhatsApp(data.campaign.validateWhatsApp !== false);
          setEditStopGroup(data.campaign.stopGroupOnSuccess !== false);

          try {
            const parsedWins = typeof data.campaign.windowsJson === 'string'
              ? JSON.parse(data.campaign.windowsJson)
              : data.campaign.windowsJson || [];
            setEditWindows(parsedWins);
          } catch {
            setEditWindows([]);
          }

          try {
            const parsedDays = typeof data.campaign.allowedDays === 'string'
              ? JSON.parse(data.campaign.allowedDays)
              : data.campaign.allowedDays || [0, 1, 2, 3, 4, 5, 6];
            setEditAllowedDays(parsedDays);
          } catch {
            setEditAllowedDays([0, 1, 2, 3, 4, 5, 6]);
          }
        }
      }
    } catch (err) {
      console.error(err);
      showToast('Erro ao carregar dados da campanha', 'error');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaign(true);
    const interval = setInterval(() => {
      // Polling ativo quando estiver rodando ou esperando janela
      if (campaign && (campaign.status === 'running' || campaign.status === 'waiting_next_window')) {
        fetchCampaign(false);
      }
    }, 6000);
    return () => clearInterval(interval);
  }, [params.id, campaign?.status]);

  // Salvar Edição Rápida via PATCH
  const handleSavePatch = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/campaign/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          messageTemplate: editTemplate,
          mediaUrl: editMediaUrl || null,
          delayMin: editDelayMin,
          delayMax: editDelayMax,
          dailyLimit: editDailyLimit,
          windowsJson: editWindows,
          allowedDays: editAllowedDays,
          validateWhatsApp: editValidateWhatsApp,
          stopGroupOnSuccess: editStopGroup,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast('Campanha atualizada com sucesso!', 'success');
        setIsEditModalOpen(false);
        fetchCampaign(false);
      } else {
        showToast(data.error || 'Erro ao atualizar campanha', 'error');
      }
    } catch (err: any) {
      showToast('Erro ao conectar ao servidor: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePause = async () => {
    try {
      const res = await fetch(`/api/campaign/${params.id}/pause`, { method: 'POST' });
      if (res.ok) {
        showToast('Campanha pausada com sucesso!', 'success');
        fetchCampaign(false);
      } else showToast('Erro ao pausar', 'error');
    } catch {
      showToast('Erro na requisição', 'error');
    }
  };

  const handleResume = async () => {
    try {
      const res = await fetch(`/api/campaign/${params.id}/resume`, { method: 'POST' });
      if (res.ok) {
        showToast('Campanha retomada!', 'success');
        fetchCampaign(false);
      } else showToast('Erro ao retomar', 'error');
    } catch {
      showToast('Erro na requisição', 'error');
    }
  };

  const handleDispatchNow = async () => {
    if (!confirm('Deseja forçar o próximo disparo desta campanha agora?')) return;
    setDispatching(true);
    try {
      const res = await fetch(`/api/campaign/${params.id}/dispatch-now`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        showToast('Disparo iniciado!', 'success');
        fetchCampaign(false);
      } else {
        showToast(data.error || 'Erro ao iniciar disparo', 'error');
      }
    } catch {
      showToast('Erro na requisição', 'error');
    } finally {
      setDispatching(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja excluir esta campanha e todos os seus registros?')) return;
    try {
      const res = await fetch(`/api/campaign/${params.id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Campanha excluída!', 'success');
        router.push('/disparador');
      } else showToast('Erro ao excluir', 'error');
    } catch {
      showToast('Erro na requisição', 'error');
    }
  };

  // Helper de janelas na modal de edição
  const addEditWindow = () => {
    setEditWindows([...editWindows, { start: '08:00', end: '10:00', limit: 12 }]);
  };

  const removeEditWindow = (index: number) => {
    setEditWindows(editWindows.filter((_, i) => i !== index));
  };

  const updateEditWindow = (index: number, updates: Partial<TimeWindow>) => {
    setEditWindows(editWindows.map((w, i) => (i === index ? { ...w, ...updates } : w)));
  };

  // Filtragem da tabela de contatos
  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      const matchesSearch =
        !searchTerm ||
        String(c.normalizedPhone || c.number || '').includes(searchTerm) ||
        (c.name && c.name.toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchesSearch) return false;

      if (statusFilter === 'all') return true;
      if (statusFilter === 'sent') return c.status === 'sent';
      if (statusFilter === 'pending') return c.status === 'pending' || c.status === 'processing';
      if (statusFilter === 'no_whatsapp') return c.status === 'no_whatsapp';
      if (statusFilter === 'failed') return c.status === 'failed';
      if (statusFilter === 'skipped') return c.status === 'skipped_group_done' || c.status === 'skipped_duplicate';
      return true;
    });
  }, [contacts, searchTerm, statusFilter]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center mt-20 text-white">
        <h1 className="text-2xl font-bold mb-4">Campanha não encontrada</h1>
        <button
          onClick={() => router.push('/disparador')}
          className="text-emerald-400 hover:underline"
        >
          Voltar ao Painel
        </button>
      </div>
    );
  }

  const isEditable = ['pending', 'scheduled', 'paused', 'waiting_next_window', 'paused_disconnected'].includes(
    campaign.status
  );

  return (
    <div className="min-h-screen bg-black text-white p-4 sm:p-6 lg:p-8 font-sans selection:bg-emerald-500/30">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl transition-all animate-in fade-in slide-in-from-top-4 ${
            toast.type === 'error'
              ? 'bg-red-500/10 border border-red-500/20 text-red-400'
              : toast.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
              : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
          }`}
        >
          {toast.type === 'error' && <XCircle className="w-5 h-5" />}
          {toast.type === 'success' && <CheckCircle2 className="w-5 h-5" />}
          {toast.type === 'warning' && <AlertTriangle className="w-5 h-5" />}
          <span className="font-medium text-sm">{toast.message}</span>
        </div>
      )}

      <div className="max-w-[1500px] mx-auto space-y-8">
        
        {/* Header com Status & Ações */}
        <header className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-zinc-800/80 pb-6 gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/disparador')}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  {campaign.name}
                </h1>

                {/* Status Badges */}
                {campaign.status === 'running' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-bold animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Rodando
                  </span>
                )}
                {campaign.status === 'waiting_next_window' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-xs font-bold">
                    <Clock className="w-3.5 h-3.5" /> Aguardando Próxima Janela
                  </span>
                )}
                {campaign.status === 'scheduled' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/30 text-xs font-bold">
                    <Calendar className="w-3.5 h-3.5" /> Agendada
                  </span>
                )}
                {campaign.status === 'paused' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs font-bold">
                    <PauseCircle className="w-3.5 h-3.5" /> Pausada
                  </span>
                )}
                {campaign.status === 'paused_disconnected' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/30 text-xs font-bold">
                    <AlertTriangle className="w-3.5 h-3.5" /> Pausada (WhatsApp Desconectado)
                  </span>
                )}
                {campaign.status === 'completed' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30 text-xs font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Concluída
                  </span>
                )}
                {campaign.provider === 'meta_official' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-xs font-bold">
                    <Zap className="w-3.5 h-3.5" /> API Oficial Meta
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400 mt-2">
                <span>{campaign.provider === 'meta_official' ? 'Canal: ' : 'Instância: '}<strong className="text-zinc-200">{campaign.instanceName}</strong></span>
                {campaign.client && (
                  <span>• Cliente: <strong className="text-emerald-400">{campaign.client.name}</strong></span>
                )}
                {campaign.metaTemplateName && (
                  <span>• Template: <strong className="text-cyan-400 font-mono">{campaign.metaTemplateName}</strong></span>
                )}
                <span>• Formato: <span className="uppercase text-zinc-300 font-bold">{campaign.messageMode}</span></span>
              </div>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Exportar CSV */}
            <a
              href={`/api/campaign/${params.id}/export`}
              download
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-bold text-xs transition-all cursor-pointer shadow"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              Exportar Relatório CSV
            </a>

            {/* Editar Campanha */}
            {isEditable && (
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-emerald-400 border border-emerald-500/30 font-bold text-xs transition-all cursor-pointer"
              >
                <Edit3 className="w-4 h-4" />
                Editar Campanha
              </button>
            )}

            {/* Pausar */}
            {(campaign.status === 'running' || campaign.status === 'waiting_next_window') && (
              <button
                onClick={handlePause}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold text-xs transition-all cursor-pointer"
              >
                <PauseCircle className="w-4 h-4" />
                Pausar
              </button>
            )}

            {/* Retomar */}
            {(campaign.status === 'paused' || campaign.status === 'paused_disconnected') && (
              <button
                onClick={handleResume}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold text-xs transition-all cursor-pointer"
              >
                <PlayCircle className="w-4 h-4" />
                Retomar
              </button>
            )}

            {/* Disparar Agora */}
            {['pending', 'scheduled', 'paused', 'waiting_next_window'].includes(campaign.status) && (
              <button
                onClick={handleDispatchNow}
                disabled={dispatching}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs transition-all disabled:opacity-50 cursor-pointer shadow-lg shadow-emerald-500/20"
              >
                <PlayCircle className="w-4 h-4 fill-black" />
                {dispatching ? 'Iniciando...' : 'Disparar Agora'}
              </button>
            )}

            {/* Excluir */}
            <button
              onClick={handleDelete}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-bold text-xs transition-all cursor-pointer"
              title="Excluir campanha"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Alerta se chip desconectado */}
        {campaign.status === 'paused_disconnected' && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center justify-between">
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <strong>WhatsApp Desconectado:</strong> O envio foi pausado automaticamente porque a instância "{campaign.instanceName}" perdeu conexão. Reconecte o chip e clique em Retomar.
            </span>
            <a
              href={`/conectar/${campaign.client?.slug || ''}`}
              target="_blank"
              className="underline font-bold hover:text-white flex items-center gap-1"
            >
              Abrir QR Code de Conexão <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}

        {/* Alerta explicativo se aguardando próxima janela de horário/dia */}
        {campaign.status === 'waiting_next_window' && (
          <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 shrink-0 text-cyan-400 mt-0.5" />
              <div>
                <p className="font-bold text-sm text-cyan-200">
                  Campanha em Pausa Automática de Segurança (Anti-ban)
                </p>
                <p className="text-zinc-300 mt-1">
                  <strong>Status do Agendador:</strong> {campaign.pauseReason || 'Aguardando próxima janela permitida de horário ou dia da semana'}.
                </p>
                {campaign.nextDispatchAt && (
                  <p className="text-cyan-400 font-mono text-[11px] mt-1">
                    Próxima abertura automática: {new Date(campaign.nextDispatchAt).toLocaleString('pt-BR')}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-500/30 font-semibold text-xs transition-all cursor-pointer"
              >
                Ajustar Dias / Horários
              </button>
              <button
                onClick={handleDispatchNow}
                disabled={dispatching}
                className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs transition-all cursor-pointer shadow-lg shadow-emerald-500/20"
              >
                Disparar Agora
              </button>
            </div>
          </div>
        )}

        {/* Cartões de Contadores Reais por Status */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
          <div className="bg-zinc-900/40 p-4 rounded-2xl border border-zinc-800">
            <span className="text-[10px] uppercase font-bold text-zinc-500 block">Total</span>
            <p className="text-2xl font-light text-white mt-1">{campaign.total}</p>
          </div>

          <div className="bg-emerald-950/20 p-4 rounded-2xl border border-emerald-500/30">
            <span className="text-[10px] uppercase font-bold text-emerald-400 block flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Enviados
            </span>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{campaign.sent}</p>
          </div>

          <div className="bg-zinc-900/40 p-4 rounded-2xl border border-zinc-800">
            <span className="text-[10px] uppercase font-bold text-zinc-400 block flex items-center gap-1">
              <Clock className="w-3 h-3" /> Pendentes
            </span>
            <p className="text-2xl font-light text-zinc-300 mt-1">{campaign.pending}</p>
          </div>

          <div className="bg-amber-950/20 p-4 rounded-2xl border border-amber-500/30">
            <span className="text-[10px] uppercase font-bold text-amber-400 block flex items-center gap-1">
              <Smartphone className="w-3 h-3" /> Sem WhatsApp
            </span>
            <p className="text-2xl font-bold text-amber-400 mt-1">{campaign.noWhatsApp}</p>
          </div>

          <div className="bg-red-950/20 p-4 rounded-2xl border border-red-500/30">
            <span className="text-[10px] uppercase font-bold text-red-400 block flex items-center gap-1">
              <XCircle className="w-3 h-3" /> Falhas
            </span>
            <p className="text-2xl font-bold text-red-400 mt-1">{campaign.failed}</p>
          </div>

          <div className="bg-purple-950/20 p-4 rounded-2xl border border-purple-500/30">
            <span className="text-[10px] uppercase font-bold text-purple-400 block flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Ignorados
            </span>
            <p className="text-2xl font-bold text-purple-400 mt-1">{campaign.skipped}</p>
          </div>
        </div>

        {/* Painel de Monitoramento da Cadência & Janela Atual */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Card: Status da Janela e Próximo Disparo */}
          <div className="bg-zinc-900/40 p-5 rounded-3xl border border-zinc-800/60 space-y-3">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-emerald-400" />
              Janela Atual & Próximo Disparo
            </span>
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">Slot Ativo:</span>
                <span className="font-mono text-zinc-200 font-semibold">
                  {campaign.currentSlot || 'Aguardando próxima janela'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">Próximo Disparo:</span>
                <span className="font-mono text-emerald-400 font-bold">
                  {campaign.nextDispatchAt
                    ? new Date(campaign.nextDispatchAt).toLocaleString('pt-BR')
                    : 'Imediato'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">Intervalo Randômico:</span>
                <span className="font-mono text-zinc-300">
                  {campaign.delayMin}s – {campaign.delayMax}s
                </span>
              </div>
            </div>
          </div>

          {/* Card: Consumo de Cota */}
          <div className="bg-zinc-900/40 p-5 rounded-3xl border border-zinc-800/60 space-y-3">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              Consumo de Cotas
            </span>
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">Envios no Turno Atual:</span>
                <span className="font-mono text-cyan-300 font-bold">
                  {campaign.currentSlotCount || 0} envios
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">Envios Hoje:</span>
                <span className="font-mono text-zinc-200 font-semibold">
                  {campaign.todayCount || 0} / {campaign.dailyLimit || '∞'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">Pré-validação WhatsApp:</span>
                <span className="text-emerald-400 font-bold">
                  {campaign.validateWhatsApp !== false ? 'Ativa' : 'Desativada'}
                </span>
              </div>
            </div>
          </div>

          {/* Card: Copy / Template */}
          <div className="bg-zinc-900/40 p-5 rounded-3xl border border-zinc-800/60 space-y-3">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
              <span>Mensagem Configurada</span>
              {isEditable && (
                <button
                  onClick={() => setIsEditModalOpen(true)}
                  className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 className="w-3 h-3" /> Editar
                </button>
              )}
            </span>
            <p className="text-xs text-zinc-300 whitespace-pre-wrap line-clamp-4 font-mono bg-black/40 p-2.5 rounded-xl border border-zinc-800">
              {campaign.messageTemplate || '(Sem texto configurado)'}
            </p>
          </div>
        </div>

        {/* Tabela de Destinatários com Filtro e Busca */}
        <div className="bg-zinc-900/40 rounded-3xl border border-zinc-800/60 shadow-2xl overflow-hidden space-y-4 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              Relatório de Destinatários ({filteredContacts.length} exibidos)
            </h2>

            <div className="flex flex-wrap items-center gap-2">
              {/* Barra de Busca */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Buscar número ou nome..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-black/50 border border-zinc-700/60 rounded-xl pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              {/* Filtro de Status */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-black/50 border border-zinc-700/60 rounded-xl px-3 py-1.5 text-xs text-zinc-200 focus:outline-none cursor-pointer"
              >
                <option value="all">Todos os Status</option>
                <option value="sent">Enviados</option>
                <option value="pending">Pendentes</option>
                <option value="no_whatsapp">Sem WhatsApp</option>
                <option value="failed">Falhas</option>
                <option value="skipped">Ignorados</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-zinc-800 max-h-[550px] overflow-y-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-zinc-900 text-zinc-400 uppercase text-[10px] sticky top-0">
                <tr>
                  <th className="px-4 py-3">Contato</th>
                  <th className="px-4 py-3">Telefone Normalizado</th>
                  <th className="px-4 py-3">Grupo</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Detalhe / Erro</th>
                  <th className="px-4 py-3 text-right">Data/Hora Envio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 bg-black/40">
                {filteredContacts.map((c) => (
                  <tr key={c.id} className="hover:bg-zinc-800/20">
                    <td className="px-4 py-3">
                      <span className="font-semibold text-white block">
                        {c.name || <span className="text-zinc-600 font-normal">(sem nome)</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-emerald-400 font-semibold">
                      {c.normalizedPhone || c.number}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-zinc-500">
                      {c.contactGroupKey ? (
                        <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
                          {c.contactGroupKey}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {c.status === 'sent' && (
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                          <CheckCircle2 className="w-3 h-3" /> Enviado
                          {c.metaStatus && (
                            <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/40 ml-1">
                              {c.metaStatus}
                            </span>
                          )}
                        </span>
                      )}
                      {c.status === 'pending' && (
                        <span className="inline-flex items-center gap-1 text-zinc-400">
                          <Clock className="w-3 h-3" /> Pendente
                        </span>
                      )}
                      {c.status === 'processing' && (
                        <span className="inline-flex items-center gap-1 text-amber-400 animate-pulse">
                          <RefreshCw className="w-3 h-3 animate-spin" /> Disparando...
                        </span>
                      )}
                      {c.status === 'no_whatsapp' && (
                        <span className="inline-flex items-center gap-1 text-amber-400 font-semibold">
                          <Smartphone className="w-3 h-3" /> Sem WhatsApp
                        </span>
                      )}
                      {c.status === 'failed' && (
                        <span className="inline-flex items-center gap-1 text-red-400 font-semibold">
                          <XCircle className="w-3 h-3" /> Falha
                        </span>
                      )}
                      {(c.status === 'skipped_group_done' || c.status === 'skipped_duplicate') && (
                        <span className="inline-flex items-center gap-1 text-purple-400 font-semibold">
                          <ShieldCheck className="w-3 h-3" /> Ignorado
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-400 text-[11px] max-w-xs truncate">
                      {c.error || '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-zinc-400 text-[11px]">
                      {c.sentAt ? new Date(c.sentAt).toLocaleString('pt-BR') : '-'}
                    </td>
                  </tr>
                ))}
                {filteredContacts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-zinc-500">
                      Nenhum contato encontrado para este filtro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Modal de Edição Rápida */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-2xl w-full p-6 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-emerald-400" />
                Edição Rápida da Campanha
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1.5">
                  Nome da Campanha
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-black/60 border border-zinc-700/60 rounded-xl p-3 text-sm text-zinc-200"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1.5">
                  Texto da Mensagem (com suporte a variáveis e Spintax)
                </label>
                <textarea
                  rows={5}
                  value={editTemplate}
                  onChange={(e) => setEditTemplate(e.target.value)}
                  className="w-full bg-black/60 border border-zinc-700/60 rounded-xl p-3 text-sm text-zinc-200 leading-relaxed font-sans"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1.5">
                  URL da Mídia (Imagem, Vídeo ou Áudio)
                </label>
                <input
                  type="text"
                  value={editMediaUrl}
                  onChange={(e) => setEditMediaUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-black/60 border border-zinc-700/60 rounded-xl p-3 text-sm text-zinc-200"
                />
              </div>

              {/* Editor de Dias da Semana Permitidos */}
              <div className="space-y-2 pt-2 border-t border-zinc-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <label className="text-xs font-semibold text-zinc-300 block">
                    Dias da Semana Permitidos (Sábado e Domingo)
                  </label>
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => setEditAllowedDays([0, 1, 2, 3, 4, 5, 6])}
                      className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-emerald-400 font-semibold cursor-pointer"
                    >
                      Todos (Seg-Dom)
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditAllowedDays([1, 2, 3, 4, 5, 6])}
                      className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold cursor-pointer"
                    >
                      Seg-Sáb
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditAllowedDays([1, 2, 3, 4, 5])}
                      className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-semibold cursor-pointer"
                    >
                      Seg-Sex
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditAllowedDays([0, 6])}
                      className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-teal-300 font-semibold cursor-pointer"
                    >
                      Sáb e Dom
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 1, label: 'Seg' },
                    { id: 2, label: 'Ter' },
                    { id: 3, label: 'Qua' },
                    { id: 4, label: 'Qui' },
                    { id: 5, label: 'Sex' },
                    { id: 6, label: 'Sáb' },
                    { id: 0, label: 'Dom' },
                  ].map((d) => {
                    const isSelected = editAllowedDays.includes(d.id);
                    const isWeekend = d.id === 6 || d.id === 0;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            if (editAllowedDays.length === 1) return;
                            setEditAllowedDays(editAllowedDays.filter((x) => x !== d.id));
                          } else {
                            setEditAllowedDays([...editAllowedDays, d.id].sort((a, b) => a - b));
                          }
                        }}
                        className={`w-12 h-9 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                          isSelected
                            ? isWeekend
                              ? 'bg-teal-500/20 text-teal-300 border-teal-500/50 shadow-sm'
                              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm'
                            : 'bg-black/40 text-zinc-500 border-zinc-800 hover:text-white'
                        }`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Editor de Janelas de Horário na Modal */}
              <div className="space-y-2 pt-2 border-t border-zinc-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-emerald-400" />
                    Janelas de Horário e Cota por Janela
                  </span>
                  <button
                    type="button"
                    onClick={addEditWindow}
                    className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar Janela
                  </button>
                </div>

                <div className="space-y-2 max-h-36 overflow-y-auto">
                  {editWindows.map((win, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-2 bg-black/40 rounded-xl border border-zinc-800 text-xs"
                    >
                      <span className="text-zinc-500 font-bold">#{idx + 1}</span>
                      <input
                        type="time"
                        value={win.start}
                        onChange={(e) => updateEditWindow(idx, { start: e.target.value })}
                        className="bg-zinc-800 rounded px-2 py-1 text-white border border-zinc-700"
                      />
                      <span className="text-zinc-500">até</span>
                      <input
                        type="time"
                        value={win.end}
                        onChange={(e) => updateEditWindow(idx, { end: e.target.value })}
                        className="bg-zinc-800 rounded px-2 py-1 text-white border border-zinc-700"
                      />
                      <span className="text-zinc-500 ml-auto">Cota:</span>
                      <input
                        type="number"
                        min={1}
                        value={win.limit}
                        onChange={(e) => updateEditWindow(idx, { limit: Number(e.target.value) || 1 })}
                        className="w-14 bg-zinc-800 rounded px-2 py-1 text-white text-center border border-zinc-700 font-bold"
                      />
                      {editWindows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeEditWindow(idx)}
                          className="text-zinc-500 hover:text-red-400 ml-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-2 border-t border-zinc-800">
                <div>
                  <label className="text-xs font-semibold text-zinc-400 block mb-1">
                    Delay Mín (s)
                  </label>
                  <input
                    type="number"
                    value={editDelayMin}
                    onChange={(e) => setEditDelayMin(Number(e.target.value))}
                    className="w-full bg-black/60 border border-zinc-700/60 rounded-xl p-2.5 text-sm text-zinc-200"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-400 block mb-1">
                    Delay Máx (s)
                  </label>
                  <input
                    type="number"
                    value={editDelayMax}
                    onChange={(e) => setEditDelayMax(Number(e.target.value))}
                    className="w-full bg-black/60 border border-zinc-700/60 rounded-xl p-2.5 text-sm text-zinc-200"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-400 block mb-1">
                    Limite Diário
                  </label>
                  <input
                    type="number"
                    value={editDailyLimit}
                    onChange={(e) => setEditDailyLimit(Number(e.target.value))}
                    className="w-full bg-black/60 border border-zinc-700/60 rounded-xl p-2.5 text-sm text-zinc-200"
                  />
                </div>
              </div>

              {/* Toggles Anti-ban */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
                  <input
                    type="checkbox"
                    checked={editValidateWhatsApp}
                    onChange={(e) => setEditValidateWhatsApp(e.target.checked)}
                    className="rounded border-zinc-700 text-emerald-500 focus:ring-0"
                  />
                  <span>Pré-validação de WhatsApp</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
                  <input
                    type="checkbox"
                    checked={editStopGroup}
                    onChange={(e) => setEditStopGroup(e.target.checked)}
                    className="rounded border-zinc-700 text-emerald-500 focus:ring-0"
                  />
                  <span>Parar grupo no primeiro sucesso</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSavePatch}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs cursor-pointer shadow-lg shadow-emerald-500/20 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
