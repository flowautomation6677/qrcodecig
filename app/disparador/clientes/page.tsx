'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  Users,
  PlusCircle,
  Copy,
  Check,
  ExternalLink,
  Trash2,
  RefreshCw,
  Smartphone,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Send,
  QrCode,
  BarChart3,
  Sparkles,
  X,
  Share2,
  Clock,
  ChevronRight,
  Zap,
  ShieldCheck,
  Radio,
  Sliders,
} from 'lucide-react';

interface ClientItem {
  id: string;
  name: string;
  slug: string;
  instanceName: string;
  status: 'connected' | 'disconnected' | 'connecting';
  createdAt: string;
  provider?: 'evolution' | 'meta_official';
  metaPhoneNumberId?: string | null;
  metaWabaId?: string | null;
  metaAccessToken?: string | null;
  _count?: {
    campaigns: number;
  };
}

const DEFAULT_CLIENT_FALLBACK: ClientItem = {
  id: 'cigarro-eletronico-default',
  name: 'Cigarro Eletrônico',
  slug: 'cigarro-eletronico',
  instanceName: 'cigarroeletronico-atendimento',
  provider: 'evolution',
  status: 'connected',
  createdAt: new Date().toISOString(),
  _count: { campaigns: 0 },
};

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientItem[]>([DEFAULT_CLIENT_FALLBACK]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  // Modal / Novo Cliente
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [connectionType, setConnectionType] = useState<'evolution' | 'meta_official'>('evolution');
  const [newName, setNewName] = useState('');
  const [newInstanceName, setNewInstanceName] = useState('');
  // Campos Meta Cloud API
  const [metaPhoneId, setMetaPhoneId] = useState('');
  const [metaWabaId, setMetaWabaId] = useState('');
  const [metaToken, setMetaToken] = useState('');
  const [testingMeta, setTestingMeta] = useState(false);
  const [metaTestSuccess, setMetaTestSuccess] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal / Edição de Cliente & Credenciais Meta
  const [editModalClient, setEditModalClient] = useState<ClientItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editProvider, setEditProvider] = useState<'evolution' | 'meta_official'>('evolution');
  const [editMetaPhoneId, setEditMetaPhoneId] = useState('');
  const [editMetaWabaId, setEditMetaWabaId] = useState('');
  const [editMetaToken, setEditMetaToken] = useState('');
  const [testingEditMeta, setTestingEditMeta] = useState(false);
  const [editMetaSuccess, setEditMetaSuccess] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const openEditModal = (client: ClientItem) => {
    setEditModalClient(client);
    setEditName(client.name);
    setEditProvider(client.provider || 'evolution');
    setEditMetaPhoneId(client.metaPhoneNumberId || '');
    setEditMetaWabaId(client.metaWabaId || '');
    setEditMetaToken(client.metaAccessToken || '');
    setEditError(null);
    setEditMetaSuccess(null);
  };

  const handleSaveEdit = async () => {
    if (!editModalClient) return;
    setSavingEdit(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/clients/${editModalClient.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          provider: editProvider,
          metaPhoneNumberId: editMetaPhoneId,
          metaWabaId: editMetaWabaId,
          metaAccessToken: editMetaToken,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error || 'Erro ao salvar alterações');
        return;
      }
      setEditModalClient(null);
      fetchClients();
    } catch (err: any) {
      setEditError(err.message || 'Erro de rede ao salvar');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleTestEditMeta = async () => {
    if (!editMetaPhoneId || !editMetaToken) {
      setEditError('Informe o Phone Number ID e o Access Token para testar.');
      return;
    }
    setTestingEditMeta(true);
    setEditError(null);
    setEditMetaSuccess(null);
    try {
      const res = await fetch('/api/clients/test-meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumberId: editMetaPhoneId,
          accessToken: editMetaToken,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setEditMetaSuccess(`Conexão confirmada! Linha: ${data.verifiedName || data.displayPhoneNumber || 'Meta Oficial'}`);
      } else {
        setEditError(data.error || 'Credenciais inválidas na Meta');
      }
    } catch (err: any) {
      setEditError(err.message || 'Falha ao testar conexão com a Meta.');
    } finally {
      setTestingEditMeta(false);
    }
  };

  // Modal / Conexão QR Code Integrada
  const [qrModalClient, setQrModalClient] = useState<ClientItem | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loadingQr, setLoadingQr] = useState<boolean>(true);
  const [isQrConnected, setIsQrConnected] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(10);
  const [qrError, setQrError] = useState<string | null>(null);

  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const qrIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const statusIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchClients = async () => {
    try {
      setRefreshing(true);
      const res = await fetch('/api/clients');
      const data = await res.json();
      if (data.clients && Array.isArray(data.clients) && data.clients.length > 0) {
        setClients(data.clients);
      } else {
        setClients([DEFAULT_CLIENT_FALLBACK]);
      }
    } catch (err) {
      console.warn('Erro ao buscar clientes, mantendo cliente ativo padrão:', err);
      setClients((prev) => (prev.length > 0 ? prev : [DEFAULT_CLIENT_FALLBACK]));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  // Limpa timers ao fechar modal do QR Code
  const closeQrModal = useCallback(() => {
    if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);
    if (qrIntervalRef.current) clearInterval(qrIntervalRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    setQrModalClient(null);
    setQrCode(null);
    setIsQrConnected(false);
    setQrError(null);
    fetchClients();
  }, []);

  // Checa status da conexão para o modal
  const checkQrStatus = useCallback(async (instanceName: string, clientId: string) => {
    if (!instanceName) return;

    try {
      const res = await fetch(`/api/whatsapp/status?instance=${encodeURIComponent(instanceName)}`);
      const statusData = await res.json();
      const state = statusData?.instance?.state || statusData?.state;

      if (state === 'open') {
        setIsQrConnected(true);
        setQrCode(null);
        setQrError(null);

        setClients((prev) =>
          prev.map((c) => (c.id === clientId ? { ...c, status: 'connected' } : c))
        );
      } else if (state === 'close' || state === 'connecting') {
        setIsQrConnected(false);
      }
    } catch (error) {
      console.warn('Erro ao verificar status do QR Code:', error);
    }
  }, []);

  // Busca QR Code dinâmico
  const fetchClientQrCode = useCallback(async (instanceName: string) => {
    if (!instanceName) return;

    setLoadingQr(true);
    setQrError(null);

    try {
      const res = await fetch(`/api/whatsapp/connect?instance=${encodeURIComponent(instanceName)}`);
      const qrData = await res.json();

      if (qrData?.instance?.state === 'open' || qrData?.state === 'open') {
        setIsQrConnected(true);
        setQrCode(null);
        return;
      }

      if (qrData.base64) {
        setQrCode(qrData.base64);
        setIsQrConnected(false);
      } else if (qrData.code) {
        setQrCode(qrData.code);
        setIsQrConnected(false);
      } else {
        setQrError('Aguardando geração do QR Code pelo servidor...');
      }
    } catch (err: any) {
      setQrError('Erro de comunicação ao carregar QR Code.');
    } finally {
      setLoadingQr(false);
    }
  }, []);

  const handleResetQr = async (instanceName: string) => {
    setLoadingQr(true);
    setQrError(null);
    try {
      await fetch('/api/whatsapp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instance: instanceName }),
      });
      await fetchClientQrCode(instanceName);
    } catch {
      fetchClientQrCode(instanceName);
    }
  };

  // Gerencia ciclo de vida do Modal do QR Code
  useEffect(() => {
    if (!qrModalClient) return;

    const instanceName = qrModalClient.instanceName;
    const clientId = qrModalClient.id;

    setIsQrConnected(qrModalClient.status === 'connected');
    setLoadingQr(true);
    setQrError(null);
    setCountdown(45);

    checkQrStatus(instanceName, clientId);
    fetchClientQrCode(instanceName);

    statusIntervalRef.current = setInterval(() => {
      checkQrStatus(instanceName, clientId);
    }, 3000);

    qrIntervalRef.current = setInterval(() => {
      fetchClientQrCode(instanceName);
    }, 45000);

    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 45 : prev - 1));
    }, 1000);

    return () => {
      if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);
      if (qrIntervalRef.current) clearInterval(qrIntervalRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [qrModalClient, checkQrStatus, fetchClientQrCode]);

  const handleCopyLink = (slug: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const link = `${origin}/conectar/${slug}`;
    navigator.clipboard.writeText(link);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 3000);
  };

  // Teste de conexão em 1 clique com a API Oficial da Meta
  const handleTestMeta = async () => {
    if (!metaPhoneId.trim() || !metaToken.trim()) {
      setErrorMessage('Informe o Phone Number ID e o Access Token para validar na Meta.');
      return;
    }

    setTestingMeta(true);
    setErrorMessage(null);
    setMetaTestSuccess(null);

    try {
      const res = await fetch('/api/clients/test-meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumberId: metaPhoneId.trim(),
          accessToken: metaToken.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Credenciais rejeitadas pela Meta.');
      }

      setMetaTestSuccess(
        `✅ Conexão validada! Nome: ${data.verifiedName} (${data.displayPhoneNumber || ''}) • Qualidade: ${data.qualityRating || 'OK'}`
      );
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao testar credenciais da Meta.');
    } finally {
      setTestingMeta(false);
    }
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setCreating(true);
    setErrorMessage(null);

    try {
      const payload: any = {
        name: newName.trim(),
        provider: connectionType,
      };

      if (connectionType === 'meta_official') {
        if (!metaPhoneId.trim() || !metaToken.trim()) {
          throw new Error('Phone Number ID e Access Token são obrigatórios para conexão oficial Meta.');
        }
        payload.metaPhoneNumberId = metaPhoneId.trim();
        payload.metaWabaId = metaWabaId.trim() || undefined;
        payload.metaAccessToken = metaToken.trim();
      } else {
        payload.instanceName = newInstanceName.trim() || undefined;
      }

      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao criar cliente');
      }

      setNewName('');
      setNewInstanceName('');
      setMetaPhoneId('');
      setMetaWabaId('');
      setMetaToken('');
      setMetaTestSuccess(null);
      setIsModalOpen(false);
      await fetchClients();

      if (connectionType === 'evolution' && data.client) {
        setQrModalClient(data.client);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha ao cadastrar cliente');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteClient = async (id: string, name: string) => {
    if (
      !confirm(
        `Tem certeza que deseja excluir o cliente "${name}"? Todas as campanhas associadas serão desvinculadas.`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/clients/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setClients((prev) => prev.filter((c) => c.id !== id));
      } else {
        const data = await res.json();
        alert(data.error || 'Erro ao excluir');
      }
    } catch (err) {
      console.error('Erro ao deletar cliente:', err);
    }
  };

  const verifiedClients = clients.filter((c) => c.status === 'connected');
  const pendingClients = clients.filter((c) => c.status !== 'connected');

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-8 font-sans">
      {/* Top Banner / Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-teal-300 to-white">
              Central de Clientes & Disparos
            </h1>
            <button
              onClick={fetchClients}
              disabled={refreshing}
              className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800/80 transition-colors cursor-pointer"
              title="Atualizar status das conexões"
            >
              <RefreshCw
                className={`w-4 h-4 ${refreshing ? 'animate-spin text-emerald-400' : ''}`}
              />
            </button>
          </div>
          <p className="text-sm text-zinc-400 mt-1.5">
            Suporte Multi-Provedor: Dispare com chips via <strong>QR Code (Evolution)</strong> ou <strong>API Oficial da Meta (Cloud API)</strong> com zero risco de banimento.
          </p>
        </div>

        <button
          onClick={() => {
            setErrorMessage(null);
            setMetaTestSuccess(null);
            setIsModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-black px-6 py-3 rounded-2xl font-bold transition-all shadow-[0_0_25px_rgba(16,185,129,0.35)] hover:shadow-[0_0_35px_rgba(16,185,129,0.55)] text-sm shrink-0 cursor-pointer"
        >
          <PlusCircle className="w-5 h-5" />
          Cadastrar Novo Cliente
        </button>
      </header>

      {/* Indicadores Rápidos */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 flex items-center gap-4 shadow-lg backdrop-blur-sm">
          <div className="w-12 h-12 rounded-xl bg-zinc-800/80 flex items-center justify-center text-zinc-300 border border-zinc-700/60">
            <Users className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <p className="text-xs uppercase font-bold text-zinc-500">Total de Clientes</p>
            <p className="text-2xl font-black text-white">{clients.length}</p>
          </div>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 flex items-center gap-4 shadow-lg backdrop-blur-sm">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs uppercase font-bold text-zinc-500">Conexões Prontas</p>
            <p className="text-2xl font-black text-emerald-400">{verifiedClients.length}</p>
          </div>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 flex items-center gap-4 shadow-lg backdrop-blur-sm">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/20">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs uppercase font-bold text-zinc-500">Aguardando Conexão</p>
            <p className="text-2xl font-black text-amber-400">{pendingClients.length}</p>
          </div>
        </div>
      </div>

      {/* SEÇÃO 1: CLIENTES VERIFICADOS & PRONTOS PARA DISPARO */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.9)]" />
            Clientes Prontos para Disparo (WhatsApp Verificado & Conectado)
          </h2>
          <span className="text-xs font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2.5 py-1 rounded-full">
            {verifiedClients.length} disponível(is)
          </span>
        </div>

        {verifiedClients.length === 0 ? (
          <div className="p-8 text-center text-zinc-400 bg-zinc-900/30 rounded-2xl border border-zinc-800/80">
            <p className="text-sm">Nenhum cliente verificado no momento. Conecte um chip abaixo ou cadastre a API Oficial da Meta.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {verifiedClients.map((client) => {
              const isMeta = client.provider === 'meta_official';

              return (
                <div
                  key={client.id}
                  className={`bg-zinc-900/70 border ${
                    isMeta ? 'border-cyan-500/40 hover:border-cyan-400' : 'border-emerald-500/30 hover:border-emerald-500/60'
                  } rounded-3xl p-6 transition-all duration-200 shadow-xl flex flex-col justify-between backdrop-blur-sm relative overflow-hidden group hover:-translate-y-0.5`}
                >
                  {/* Linha de brilho no topo */}
                  <div
                    className={`absolute top-0 left-0 right-0 h-1.5 ${
                      isMeta
                        ? 'bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400'
                        : 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600'
                    }`}
                  />

                  <div>
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-3.5">
                        <div
                          className={`w-14 h-14 rounded-2xl ${
                            isMeta
                              ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400'
                              : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                          } border flex items-center justify-center font-bold text-lg shadow-inner shrink-0`}
                        >
                          {isMeta ? <Zap className="w-7 h-7" /> : <Smartphone className="w-7 h-7" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-xl font-bold text-white group-hover:text-emerald-400 transition-colors">
                              {client.name}
                            </h3>
                            {isMeta && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm">
                                ⚡ Meta Oficial
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-mono text-zinc-400 mt-0.5 flex items-center gap-1.5">
                            <span>{isMeta ? 'Phone ID:' : 'Instância:'}</span>
                            <span className="text-zinc-200 font-semibold">
                              {isMeta ? (client.metaPhoneNumberId || client.instanceName) : client.instanceName}
                            </span>
                          </p>
                        </div>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shrink-0 ${
                          isMeta
                            ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isMeta ? 'bg-cyan-400' : 'bg-emerald-400'
                          } animate-pulse`}
                        />
                        {isMeta ? 'Oficial Ativo' : 'Verificado & Conectado'}
                      </span>
                    </div>

                    {/* Informações Rápidas */}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400 py-2 border-t border-b border-zinc-800/60 my-3 font-mono">
                      <div className="px-2.5 py-1 rounded-lg bg-zinc-950/60 border border-zinc-800/60 flex items-center gap-1.5">
                        <BarChart3 className="w-3.5 h-3.5 text-zinc-500" />
                        <span>
                          <strong className="text-white">{client._count?.campaigns || 0}</strong> disparos realizados
                        </span>
                      </div>
                      {isMeta && client.metaWabaId && (
                        <div className="px-2.5 py-1 rounded-lg bg-cyan-950/40 border border-cyan-800/40 text-cyan-300 flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                          <span>WABA: {client.metaWabaId}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bloco de Ações do Cliente */}
                  <div className="space-y-2.5 pt-2">
                    {/* BOTÃO PRINCIPAL: Disparar */}
                    <Link
                      href={`/disparador/novo?clientId=${client.id}`}
                      className={`w-full flex items-center justify-center gap-2.5 py-3.5 px-5 ${
                        isMeta
                          ? 'bg-gradient-to-r from-cyan-400 to-teal-300 hover:from-cyan-300 hover:to-teal-200 shadow-[0_0_20px_rgba(6,182,212,0.3)]'
                          : 'bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                      } text-black font-extrabold rounded-2xl text-sm transition-all active:scale-[0.99]`}
                    >
                      <Send className="w-4 h-4" />
                      <span>Iniciar Campanha com este Cliente</span>
                      <ChevronRight className="w-4 h-4 ml-1 opacity-70" />
                    </Link>

                    {/* Ações Secundárias */}
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/disparador?clientId=${client.id}`}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-zinc-800 hover:bg-zinc-700/80 text-zinc-200 rounded-xl text-xs font-semibold transition-all border border-zinc-700/60"
                        title="Ver campanhas e relatórios deste cliente"
                      >
                        <BarChart3 className="w-3.5 h-3.5 text-zinc-400" />
                        <span>Ver Campanhas</span>
                      </Link>

                      <button
                        onClick={() => openEditModal(client)}
                        className="flex items-center justify-center gap-1.5 py-2 px-3 bg-zinc-800 hover:bg-zinc-700/80 text-zinc-300 rounded-xl text-xs font-semibold transition-all border border-zinc-700/60 cursor-pointer"
                        title="Configurar credenciais e parâmetros"
                      >
                        <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Configurar</span>
                      </button>

                      {!isMeta ? (
                        <button
                          onClick={() => setQrModalClient(client)}
                          className="flex items-center justify-center gap-1.5 py-2 px-3 bg-zinc-800 hover:bg-zinc-700/80 text-zinc-300 rounded-xl text-xs font-semibold transition-all border border-zinc-700/60 cursor-pointer"
                          title="Ver status da conexão ou reconectar QR Code"
                        >
                          <QrCode className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Reconectar / QR</span>
                        </button>
                      ) : (
                        <div
                          className="flex items-center justify-center gap-1.5 py-2 px-3 bg-cyan-950/30 text-cyan-400 rounded-xl text-xs font-semibold border border-cyan-800/40"
                          title="Conexão direta na nuvem da Meta Graph API v21.0"
                        >
                          <Zap className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Nuvem Meta</span>
                        </div>
                      )}

                      {client.id !== 'cigarro-eletronico-default' && (
                        <button
                          onClick={() => handleDeleteClient(client.id, client.name)}
                          className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-950/30 rounded-xl transition-colors border border-transparent hover:border-red-900/50 cursor-pointer"
                          title="Excluir cliente"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* SEÇÃO 2: CLIENTES PENDENTES DE VERIFICAÇÃO (Chips Desconectados) */}
      {pendingClients.length > 0 && (
        <section className="space-y-4 pt-4 border-t border-zinc-800/80">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.9)]" />
              Clientes Aguardando Conexão do Chip WhatsApp
            </h2>
            <span className="text-xs font-semibold text-amber-400 bg-amber-950/60 border border-amber-800/40 px-2.5 py-1 rounded-full">
              {pendingClients.length} pendente(s)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {pendingClients.map((client) => (
              <div
                key={client.id}
                className="bg-zinc-900/60 border border-amber-500/30 hover:border-amber-500/50 rounded-3xl p-6 transition-all shadow-xl flex flex-col justify-between backdrop-blur-sm relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-amber-500/60" />

                <div>
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-3.5">
                      <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold text-lg shrink-0">
                        <Smartphone className="w-7 h-7" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white">{client.name}</h3>
                        <p className="text-xs font-mono text-zinc-400 mt-0.5">
                          Instância: <span className="text-zinc-200">{client.instanceName}</span>
                        </p>
                      </div>
                    </div>

                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shrink-0 bg-amber-500/10 text-amber-400 border border-amber-500/30">
                      <Clock className="w-3.5 h-3.5" />
                      Aguardando QR Code
                    </span>
                  </div>

                  <p className="text-xs text-zinc-400 my-2">
                    Escaneie o QR Code abaixo ou envie o link exclusivo para o seu cliente parear o WhatsApp.
                  </p>
                </div>

                <div className="space-y-2.5 pt-3 border-t border-zinc-800">
                  <button
                    onClick={() => setQrModalClient(client)}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold rounded-2xl text-xs transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
                  >
                    <QrCode className="w-4 h-4" />
                    <span>Conectar WhatsApp Agora (Abrir QR Code)</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopyLink(client.slug)}
                      className="flex-1 py-2 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-zinc-700/60 cursor-pointer"
                    >
                      {copiedSlug === client.slug ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Link Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-zinc-400" />
                          <span>Copiar Link para Cliente</span>
                        </>
                      )}
                    </button>

                    <a
                      href={`/conectar/${client.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition-colors border border-zinc-700/60"
                      title="Abrir página isolada"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>

                    <button
                      onClick={() => openEditModal(client)}
                      className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition-colors border border-zinc-700/60 cursor-pointer"
                      title="Configurar credenciais"
                    >
                      <Sliders className="w-4 h-4 text-cyan-400" />
                    </button>

                    <button
                      onClick={() => handleDeleteClient(client.id, client.name)}
                      className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-950/30 rounded-xl transition-colors border border-transparent hover:border-red-900/50 cursor-pointer"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* MODAL 1: QR CODE DE CONEXÃO */}
      {qrModalClient && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative">
            <button
              onClick={closeQrModal}
              className="absolute top-5 right-5 p-2 text-zinc-400 hover:text-white rounded-xl bg-zinc-800/60 hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-6">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 inline-block mb-3">
                {qrModalClient.name}
              </span>
              <h3 className="text-xl font-bold text-white">Pareamento de WhatsApp</h3>
              <p className="text-xs text-zinc-400 mt-1">
                Aponte o leitor de QR Code do WhatsApp em <strong>Aparelhos Conectados</strong>.
              </p>
            </div>

            {isQrConnected ? (
              <div className="text-center py-8 space-y-4">
                <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white">WhatsApp Conectado com Sucesso!</h4>
                  <p className="text-xs text-zinc-400 mt-1">
                    Este chip já está verificado e pronto para disparos contínuos.
                  </p>
                </div>
                <button
                  onClick={closeQrModal}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold rounded-xl text-sm transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
                >
                  Concluir e Voltar
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="relative bg-white p-4 rounded-2xl shadow-xl flex items-center justify-center min-h-[260px] min-w-[260px]">
                  {loadingQr && !qrCode ? (
                    <div className="flex flex-col items-center gap-2">
                      <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
                      <span className="text-xs font-semibold text-zinc-600">Gerando QR Code...</span>
                    </div>
                  ) : typeof qrCode === 'string' && qrCode ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`}
                      alt="WhatsApp QR Code"
                      className="w-56 h-56 object-contain"
                    />
                  ) : (
                    <div className="p-4 text-center text-xs text-red-500">
                      {qrError || 'Não foi possível carregar o QR Code.'}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-4 text-xs text-zinc-400">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>
                    Atualiza automaticamente em: <strong className="text-white">{countdown}s</strong>
                  </span>
                </div>

                <div className="w-full mt-4 p-3 bg-zinc-950/60 rounded-xl border border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400">Link público do QR Code:</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopyLink(qrModalClient.slug)}
                      className="flex-1 py-2 px-3 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {copiedSlug === qrModalClient.slug ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Link Copiado com Sucesso!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copiar Link do QR para o Cliente</span>
                        </>
                      )}
                    </button>
                    <a
                      href={`/conectar/${qrModalClient.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition-colors border border-zinc-700/60"
                      title="Abrir página isolada em nova aba"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>

                <div className="w-full mt-3 space-y-2.5">
                  <button
                    onClick={() => handleResetQr(qrModalClient.instanceName)}
                    disabled={loadingQr}
                    className="w-full py-2.5 px-3 bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all border border-zinc-700/60 disabled:opacity-50 cursor-pointer"
                    title="Limpa qualquer sessão presa e gera um QR Code novo"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${loadingQr ? 'animate-spin' : ''}`} />
                    <span>Gerar Novo QR Code / Reiniciar Sessão</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 2: CADASTRO DE NOVO CLIENTE (MULTI-PROVEDOR) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 p-2 text-zinc-400 hover:text-white rounded-xl bg-zinc-800/60 hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-xl font-bold text-white mb-1">Cadastrar Novo Cliente</h2>
            <p className="text-xs text-zinc-400 mb-5">
              Escolha o canal de disparo desejado para este cliente.
            </p>

            {/* Seletor de Tipo de Provedor */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-black/60 rounded-2xl border border-zinc-800 mb-5">
              <button
                type="button"
                onClick={() => {
                  setConnectionType('evolution');
                  setErrorMessage(null);
                  setMetaTestSuccess(null);
                }}
                className={`flex flex-col items-center justify-center py-3 px-3 rounded-xl transition-all cursor-pointer ${
                  connectionType === 'evolution'
                    ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20 font-bold'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <Smartphone className="w-4 h-4" />
                  <span>Chip / QR Code</span>
                </div>
                <span className="text-[10px] opacity-80 mt-0.5">Evolution API (Baileys)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setConnectionType('meta_official');
                  setErrorMessage(null);
                  setMetaTestSuccess(null);
                }}
                className={`flex flex-col items-center justify-center py-3 px-3 rounded-xl transition-all cursor-pointer ${
                  connectionType === 'meta_official'
                    ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20 font-bold'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <Zap className="w-4 h-4" />
                  <span>API Oficial Meta</span>
                </div>
                <span className="text-[10px] opacity-80 mt-0.5">WhatsApp Cloud API</span>
              </button>
            </div>

            {errorMessage && (
              <div className="mb-4 p-3 bg-red-950/60 border border-red-800/80 rounded-xl flex items-center gap-2 text-xs text-red-300">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            {metaTestSuccess && (
              <div className="mb-4 p-3 bg-emerald-950/60 border border-emerald-800/80 rounded-xl flex items-center gap-2 text-xs text-emerald-300">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{metaTestSuccess}</span>
              </div>
            )}

            <form onSubmit={handleCreateClient} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-300 uppercase mb-1.5">
                  Nome do Cliente / Empresa *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Kelly Veloso ou Imobiliária Alpha"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-colors"
                />
              </div>

              {/* Rota 1: Meta Cloud API Oficial */}
              {connectionType === 'meta_official' ? (
                <>
                  <div>
                    <label className="block text-xs font-bold text-zinc-300 uppercase mb-1.5">
                      Phone Number ID da Meta *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: 849870041539834"
                      value={metaPhoneId}
                      onChange={(e) => setMetaPhoneId(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-cyan-500 rounded-xl px-4 py-3 text-xs font-mono text-white focus:outline-none transition-colors"
                    />
                    <p className="text-[11px] text-zinc-500 mt-1">
                      Identificador numérico do número registrado no WhatsApp Business Platform.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-300 uppercase mb-1.5">
                      WhatsApp Business Account ID (WABA ID)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: 2671775253166341"
                      value={metaWabaId}
                      onChange={(e) => setMetaWabaId(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-cyan-500 rounded-xl px-4 py-3 text-xs font-mono text-white focus:outline-none transition-colors"
                    />
                    <p className="text-[11px] text-zinc-500 mt-1">
                      Necessário para consultar e listar automaticamente seus templates aprovados.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-300 uppercase mb-1.5">
                      Access Token Permanente da Meta *
                    </label>
                    <textarea
                      required
                      rows={3}
                      placeholder="EAAq2T9ZBAJGQBS8..."
                      value={metaToken}
                      onChange={(e) => setMetaToken(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-cyan-500 rounded-xl px-4 py-2.5 text-xs font-mono text-white focus:outline-none transition-colors"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleTestMeta}
                    disabled={testingMeta}
                    className="w-full py-2.5 px-3 bg-zinc-800 hover:bg-zinc-700 text-cyan-300 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all border border-cyan-800/40 cursor-pointer disabled:opacity-50"
                  >
                    <Zap className={`w-3.5 h-3.5 ${testingMeta ? 'animate-spin' : ''}`} />
                    <span>{testingMeta ? 'Testando na Meta...' : 'Testar Conexão com a Meta Agora'}</span>
                  </button>
                </>
              ) : (
                /* Rota 2: Evolution API (Chip WhatsApp) */
                <div>
                  <label className="block text-xs font-bold text-zinc-300 uppercase mb-1.5">
                    Nome da Instância na Evolution (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Deixe em branco para gerar automaticamente"
                    value={newInstanceName}
                    onChange={(e) => setNewInstanceName(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-colors font-mono text-xs"
                  />
                  <p className="text-[11px] text-zinc-500 mt-1">
                    Se você já possui uma instância criada no seu servidor da Evolution API, informe o nome aqui.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={creating}
                  className="px-4 py-2.5 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className={`flex items-center gap-2 ${
                    connectionType === 'meta_official'
                      ? 'bg-gradient-to-r from-cyan-400 to-teal-300 hover:from-cyan-300 hover:to-teal-200 shadow-[0_0_20px_rgba(6,182,212,0.3)]'
                      : 'bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                  } text-black px-5 py-2.5 rounded-xl font-bold text-xs transition-all disabled:opacity-50 cursor-pointer`}
                >
                  {creating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Cadastrando...
                    </>
                  ) : (
                    <>
                      <PlusCircle className="w-4 h-4" />
                      {connectionType === 'meta_official' ? 'Salvar Cliente Meta Oficial' : 'Cadastrar e Abrir QR Code'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: CONFIGURAÇÃO / EDIÇÃO DE CLIENTE & CREDENCIAIS META */}
      {editModalClient && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative">
            <button
              onClick={() => setEditModalClient(null)}
              className="absolute top-5 right-5 p-2 text-zinc-400 hover:text-white rounded-xl bg-zinc-800/60 hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-xl font-bold text-white mb-1">Configurar Cliente</h2>
            <p className="text-xs text-zinc-400 mb-5">
              Edite as credenciais e parâmetros de envio deste cliente.
            </p>

            {/* Seletor de Tipo de Provedor */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-black/60 rounded-2xl border border-zinc-800 mb-5">
              <button
                type="button"
                onClick={() => {
                  setEditProvider('evolution');
                  setEditError(null);
                  setEditMetaSuccess(null);
                }}
                className={`flex flex-col items-center justify-center py-3 px-3 rounded-xl transition-all cursor-pointer ${
                  editProvider === 'evolution'
                    ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20 font-bold'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <Smartphone className="w-4 h-4" />
                  <span>Chip / QR Code</span>
                </div>
                <span className="text-[10px] opacity-80 mt-0.5">Evolution API</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEditProvider('meta_official');
                  setEditError(null);
                  setEditMetaSuccess(null);
                }}
                className={`flex flex-col items-center justify-center py-3 px-3 rounded-xl transition-all cursor-pointer ${
                  editProvider === 'meta_official'
                    ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20 font-bold'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <Zap className="w-4 h-4" />
                  <span>API Oficial Meta</span>
                </div>
                <span className="text-[10px] opacity-80 mt-0.5">Cloud API v21.0</span>
              </button>
            </div>

            {editError && (
              <div className="mb-4 p-3.5 bg-red-950/40 border border-red-800/60 rounded-xl text-xs text-red-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{editError}</span>
              </div>
            )}

            {editMetaSuccess && (
              <div className="mb-4 p-3.5 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-xs text-emerald-300 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{editMetaSuccess}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-300 uppercase mb-1.5">
                  Nome do Cliente
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-colors"
                />
              </div>

              {editProvider === 'meta_official' ? (
                <>
                  <div>
                    <label className="block text-xs font-bold text-zinc-300 uppercase mb-1.5">
                      Phone Number ID da Meta
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: 849870041539834"
                      value={editMetaPhoneId}
                      onChange={(e) => setEditMetaPhoneId(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-cyan-500 rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-colors font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-300 uppercase mb-1.5">
                      WABA ID (WhatsApp Business Account ID)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: 2671775253166341"
                      value={editMetaWabaId}
                      onChange={(e) => setEditMetaWabaId(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-cyan-500 rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-colors font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-300 uppercase mb-1.5">
                      Access Token Permanente de Sistema
                    </label>
                    <textarea
                      rows={3}
                      placeholder="EAAq2T9..."
                      value={editMetaToken}
                      onChange={(e) => setEditMetaToken(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-cyan-500 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none transition-colors font-mono break-all"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleTestEditMeta}
                    disabled={testingEditMeta}
                    className="w-full py-2.5 px-3 bg-zinc-800 hover:bg-zinc-700 text-cyan-300 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all border border-cyan-800/40 cursor-pointer disabled:opacity-50"
                  >
                    <Zap className={`w-3.5 h-3.5 ${testingEditMeta ? 'animate-spin' : ''}`} />
                    <span>{testingEditMeta ? 'Validando na Meta...' : 'Testar Conexão com a Meta Agora'}</span>
                  </button>
                </>
              ) : (
                <div className="p-3.5 bg-zinc-950/60 border border-zinc-800 rounded-2xl text-xs text-zinc-400">
                  <p className="font-semibold text-zinc-200 mb-1 flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-emerald-400" />
                    Conexão por Chip (Evolution API)
                  </p>
                  <p>
                    Instância ativa:{' '}
                    <strong className="text-white font-mono">{editModalClient.instanceName}</strong>.
                    Você pode conectar ou re-parear o WhatsApp deste cliente clicando em "Reconectar / QR" no card.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setEditModalClient(null)}
                  disabled={savingEdit}
                  className="px-4 py-2.5 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={savingEdit}
                  className={`flex items-center gap-2 ${
                    editProvider === 'meta_official'
                      ? 'bg-gradient-to-r from-cyan-400 to-teal-300 hover:from-cyan-300 hover:to-teal-200 shadow-[0_0_20px_rgba(6,182,212,0.3)]'
                      : 'bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                  } text-black px-5 py-2.5 rounded-xl font-bold text-xs transition-all disabled:opacity-50 cursor-pointer`}
                >
                  {savingEdit ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Salvar Alterações
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
