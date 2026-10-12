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
  Lock,
} from 'lucide-react';

interface ClientItem {
  id: string;
  name: string;
  slug: string;
  instanceName: string;
  status: 'connected' | 'disconnected' | 'connecting';
  createdAt: string;
  _count?: {
    campaigns: number;
  };
}

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  // Modal / Novo Cliente
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newInstanceName, setNewInstanceName] = useState('');
  const [creating, setCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
      if (data.clients) {
        setClients(data.clients);
      }
    } catch (err) {
      console.error('Erro ao buscar clientes:', err);
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

        // Atualiza status local do cliente no card
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
        setCountdown(10);
      } else if (qrData.qrcode?.base64) {
        setQrCode(qrData.qrcode.base64);
        setCountdown(10);
      } else if (qrData.code) {
        setQrCode(qrData.code);
        setCountdown(10);
      } else if (qrData.error) {
        setQrError(qrData.error || 'Erro ao gerar o QR Code.');
      }
    } catch (error: any) {
      setQrError(error?.message || 'Falha ao conectar com a Evolution API.');
    } finally {
      setLoadingQr(false);
    }
  }, []);

  // Gerencia ciclo de vida do Modal do QR Code
  useEffect(() => {
    if (!qrModalClient) return;

    const instanceName = qrModalClient.instanceName;
    const clientId = qrModalClient.id;

    // Reseta estados
    setIsQrConnected(qrModalClient.status === 'connected');
    setLoadingQr(true);
    setQrError(null);

    // Primeira checagem
    checkQrStatus(instanceName, clientId);
    fetchClientQrCode(instanceName);

    // Polling a cada 3s
    statusIntervalRef.current = setInterval(() => {
      checkQrStatus(instanceName, clientId);
    }, 3000);

    // Renovação do QR a cada 10s
    qrIntervalRef.current = setInterval(() => {
      fetchClientQrCode(instanceName);
    }, 10000);

    // Contagem regressiva
    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 10 : prev - 1));
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
    setTimeout(() => setCopiedSlug(null), 2500);
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setCreating(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          instanceName: newInstanceName.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao criar cliente');
      }

      setNewName('');
      setNewInstanceName('');
      setIsModalOpen(false);
      await fetchClients();

      // Já abre imediatamente o modal de QR Code para conectar este novo cliente!
      if (data.client) {
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

  const totalClients = clients.length;
  const connectedCount = clients.filter((c) => c.status === 'connected').length;
  const disconnectedCount = clients.filter((c) => c.status !== 'connected').length;

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-8">
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
              className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800/80 transition-colors"
              title="Atualizar status das conexões"
            >
              <RefreshCw
                className={`w-4 h-4 ${refreshing ? 'animate-spin text-emerald-400' : ''}`}
              />
            </button>
          </div>
          <p className="text-sm text-zinc-400 mt-1.5">
            Selecione o cliente abaixo para iniciar um disparo imediato com o chip dele ou conectar/gerenciar o WhatsApp.
          </p>
        </div>

        <button
          onClick={() => {
            setErrorMessage(null);
            setIsModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-black px-6 py-3 rounded-2xl font-bold transition-all shadow-[0_0_25px_rgba(16,185,129,0.35)] hover:shadow-[0_0_35px_rgba(16,185,129,0.55)] text-sm shrink-0"
        >
          <PlusCircle className="w-5 h-5" />
          Cadastrar Novo Cliente
        </button>
      </header>

      {/* Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 flex items-center gap-4 shadow-lg backdrop-blur-sm">
          <div className="w-12 h-12 rounded-xl bg-zinc-800/80 flex items-center justify-center text-zinc-300 border border-zinc-700/60">
            <Users className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <p className="text-xs uppercase font-bold text-zinc-500">Total de Clientes</p>
            <p className="text-2xl font-black text-white">{totalClients}</p>
          </div>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 flex items-center gap-4 shadow-lg backdrop-blur-sm">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs uppercase font-bold text-zinc-500">Chips Conectados</p>
            <p className="text-2xl font-black text-emerald-400">{connectedCount}</p>
          </div>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 flex items-center gap-4 shadow-lg backdrop-blur-sm">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400 border border-red-500/20">
            <XCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs uppercase font-bold text-zinc-500">Aguardando Conexão</p>
            <p className="text-2xl font-black text-zinc-400">{disconnectedCount}</p>
          </div>
        </div>
      </div>

      {/* Conteúdo Principal: Grid de Clientes para Escolher */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-20 text-zinc-400 bg-zinc-900/30 rounded-3xl border border-zinc-800/80">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-400 mb-3" />
          <p className="text-sm font-medium">Carregando seus clientes e checando conexões do WhatsApp...</p>
        </div>
      ) : clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 text-center bg-zinc-900/30 rounded-3xl border border-zinc-800 border-dashed max-w-2xl mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-zinc-800/80 flex items-center justify-center text-zinc-500 mb-4 border border-zinc-700/60">
            <Users className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Nenhum cliente cadastrado ainda</h3>
          <p className="text-sm text-zinc-400 mb-6 max-w-md">
            Cadastre o seu primeiro cliente ou empresa para conectar o chip WhatsApp e disparar campanhas por ele!
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black px-6 py-3 rounded-2xl font-bold transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] text-sm"
          >
            <PlusCircle className="w-5 h-5" />
            Cadastrar Primeiro Cliente
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              Escolha um Cliente para Operar:
            </h2>
            <span className="text-xs text-zinc-500">
              {clients.length} {clients.length === 1 ? 'cliente configurado' : 'clientes configurados'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {clients.map((client) => {
              const isConnected = client.status === 'connected';

              return (
                <div
                  key={client.id}
                  className={`bg-zinc-900/60 border rounded-3xl p-6 transition-all duration-200 shadow-xl flex flex-col justify-between backdrop-blur-sm relative overflow-hidden group hover:-translate-y-0.5 ${
                    isConnected
                      ? 'border-emerald-500/30 hover:border-emerald-500/60 shadow-emerald-950/20'
                      : 'border-zinc-800 hover:border-zinc-700 shadow-black'
                  }`}
                >
                  {/* Luz de destaque no topo */}
                  <div
                    className={`absolute top-0 left-0 right-0 h-1.5 ${
                      isConnected
                        ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600'
                        : 'bg-red-500/50'
                    }`}
                  />

                  {/* Informações do Cliente */}
                  <div>
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex items-center gap-3.5">
                        <div
                          className={`w-14 h-14 rounded-2xl flex items-center justify-center border font-bold text-lg shadow-inner shrink-0 ${
                            isConnected
                              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                              : 'bg-zinc-800/80 border-zinc-700 text-zinc-400'
                          }`}
                        >
                          <Smartphone className="w-7 h-7" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-white group-hover:text-emerald-400 transition-colors">
                            {client.name}
                          </h3>
                          <p className="text-xs font-mono text-zinc-400 mt-0.5 flex items-center gap-1.5">
                            <span>Instância:</span>
                            <span className="text-zinc-200 font-semibold">{client.instanceName}</span>
                          </p>
                        </div>
                      </div>

                      {/* Badge de Conexão */}
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shrink-0 border ${
                          isConnected
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                            : 'bg-red-500/10 text-red-400 border-red-500/30'
                        }`}
                      >
                        {isConnected ? (
                          <>
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            Conectado
                          </>
                        ) : (
                          <>
                            <span className="w-2 h-2 rounded-full bg-red-400" />
                            Desconectado
                          </>
                        )}
                      </span>
                    </div>

                    {/* Metadados rápidos */}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400 py-2 border-t border-b border-zinc-800/60 my-4 font-mono">
                      <div className="px-2.5 py-1 rounded-lg bg-zinc-950/60 border border-zinc-800/60 flex items-center gap-1.5">
                        <BarChart3 className="w-3.5 h-3.5 text-zinc-500" />
                        <span>
                          <strong className="text-white">{client._count?.campaigns || 0}</strong>{' '}
                          campanhas disparadas
                        </span>
                      </div>
                      <div className="px-2.5 py-1 rounded-lg bg-zinc-950/60 border border-zinc-800/60 flex items-center gap-1.5">
                        <QrCode className="w-3.5 h-3.5 text-zinc-500" />
                        <span className="text-zinc-400">/conectar/{client.slug}</span>
                      </div>
                    </div>
                  </div>

                  {/* Bloco de Ações do Cliente */}
                  <div className="space-y-3 pt-2">
                    {/* BOTÃO PRINCIPAL DINÂMICO */}
                    {isConnected ? (
                      <Link
                        href={`/disparador/novo?clientId=${client.id}`}
                        className="w-full flex items-center justify-center gap-2.5 py-3.5 px-5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-black font-extrabold rounded-2xl text-sm transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] active:scale-[0.99]"
                      >
                        <Send className="w-4 h-4" />
                        <span>Fazer Disparo com este Cliente</span>
                      </Link>
                    ) : (
                      <button
                        onClick={() => setQrModalClient(client)}
                        className="w-full flex items-center justify-center gap-2.5 py-3.5 px-5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-extrabold rounded-2xl text-sm transition-all shadow-[0_0_20px_rgba(245,158,11,0.25)] hover:shadow-[0_0_30px_rgba(245,158,11,0.4)] active:scale-[0.99]"
                      >
                        <QrCode className="w-4 h-4" />
                        <span>Conectar WhatsApp (Escanear QR Code)</span>
                      </button>
                    )}

                    {/* Ações Secundárias */}
                    <div className="flex items-center gap-2 pt-1">
                      {/* Botão de Conexão do QR (Abre Modal na tela) */}
                      <button
                        onClick={() => setQrModalClient(client)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-zinc-800 hover:bg-zinc-700/80 text-zinc-200 rounded-xl text-xs font-semibold transition-all border border-zinc-700/60"
                        title="Abrir QR Code na tela para escanear"
                      >
                        <QrCode className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{isConnected ? 'Ver Conexão QR' : 'Escanear QR'}</span>
                      </button>

                      {/* Botão Copiar Link */}
                      <button
                        onClick={() => handleCopyLink(client.slug)}
                        className="flex items-center justify-center gap-1.5 py-2 px-3 bg-zinc-800 hover:bg-zinc-700/80 text-zinc-200 rounded-xl text-xs font-semibold transition-all border border-zinc-700/60"
                        title="Copiar link para o cliente abrir no celular dele"
                      >
                        {copiedSlug === client.slug ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-zinc-400" />
                            <span>Copiar Link</span>
                          </>
                        )}
                      </button>

                      {/* Botão Ver Campanhas */}
                      <Link
                        href={`/disparador?clientId=${client.id}`}
                        className="p-2 bg-zinc-800 hover:bg-zinc-700/80 text-zinc-400 hover:text-white rounded-xl transition-all border border-zinc-700/60"
                        title="Ver histórico de campanhas deste cliente"
                      >
                        <BarChart3 className="w-4 h-4" />
                      </Link>

                      {/* Botão Excluir */}
                      <button
                        onClick={() => handleDeleteClient(client.id, client.name)}
                        className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-950/30 rounded-xl transition-colors border border-transparent hover:border-red-900/50"
                        title="Excluir cliente"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL 1: QR CODE INTEGRADO DIRETAMENTE NA TELA */}
      {qrModalClient && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative animate-fade-in">
            {/* Fechar */}
            <button
              onClick={closeQrModal}
              className="absolute top-5 right-5 p-2 text-zinc-400 hover:text-white rounded-xl bg-zinc-800/60 hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Cabeçalho do Modal */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white shrink-0">
                <Smartphone className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white leading-tight">
                  {qrModalClient.name}
                </h2>
                <p className="text-xs font-mono text-emerald-400 mt-0.5">
                  Instância: {qrModalClient.instanceName}
                </p>
              </div>
            </div>

            {/* Conteúdo: Conectado vs QR Code */}
            {isQrConnected ? (
              <div className="flex flex-col items-center text-center py-6">
                <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center mb-5 shadow-lg shadow-emerald-500/30">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">WhatsApp Conectado!</h3>
                <p className="text-sm text-zinc-300 max-w-xs mb-6">
                  O chip deste cliente está sincronizado e pronto para disparos na Evolution API.
                </p>

                <div className="w-full space-y-3">
                  <Link
                    href={`/disparador/novo?clientId=${qrModalClient.id}`}
                    onClick={closeQrModal}
                    className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-400 text-black font-extrabold rounded-2xl text-sm shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 transition-all"
                  >
                    <Send className="w-4 h-4" />
                    Ir para Disparos deste Cliente
                  </Link>

                  <button
                    onClick={closeQrModal}
                    className="w-full py-2.5 text-xs text-zinc-400 hover:text-white transition-colors"
                  >
                    Fechar Janela
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                {/* Box do QR Code */}
                <div className="relative w-64 h-64 bg-white rounded-2xl p-3 flex items-center justify-center shadow-inner overflow-hidden border-4 border-zinc-800">
                  {loadingQr && !qrCode ? (
                    <div className="flex flex-col items-center gap-2 text-zinc-700">
                      <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
                      <span className="text-xs font-medium">Gerando QR Code...</span>
                    </div>
                  ) : qrError ? (
                    <div className="text-center p-3 text-red-600">
                      <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                      <p className="text-xs font-semibold">{qrError}</p>
                      <button
                        onClick={() => fetchClientQrCode(qrModalClient.instanceName)}
                        className="mt-3 px-3 py-1.5 bg-zinc-900 text-white rounded-lg text-xs hover:bg-zinc-800"
                      >
                        Tentar Novamente
                      </button>
                    </div>
                  ) : qrCode ? (
                    <img
                      src={
                        qrCode.startsWith('data:image')
                          ? qrCode
                          : `data:image/png;base64,${qrCode}`
                      }
                      alt="QR Code WhatsApp"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="flex flex-col items-center text-zinc-400">
                      <QrCode className="w-12 h-12 mb-2" />
                      <span className="text-xs">Aguardando código...</span>
                    </div>
                  )}
                </div>

                {/* Contador de Renovação */}
                {qrCode && (
                  <div className="w-full mt-3 flex items-center justify-between text-xs text-zinc-400 px-3">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      Atualizando em
                    </span>
                    <span className="font-mono font-bold text-emerald-400">{countdown}s</span>
                  </div>
                )}

                {/* Instruções */}
                <div className="w-full mt-4 space-y-2 text-xs text-zinc-300 bg-zinc-950/70 p-3.5 rounded-2xl border border-zinc-800/80">
                  <p className="font-semibold text-white flex items-center gap-1.5 mb-1">
                    <Smartphone className="w-3.5 h-3.5 text-emerald-400" /> Como conectar:
                  </p>
                  <p>1. Abra o WhatsApp no celular</p>
                  <p>2. Toque em <strong>Aparelhos conectados</strong> &gt; <strong>Conectar aparelho</strong></p>
                  <p>3. Aponte a câmera para o QR Code acima</p>
                </div>

                {/* Botão Copiar Link Externo */}
                <div className="w-full mt-4 flex items-center gap-2">
                  <button
                    onClick={() => handleCopyLink(qrModalClient.slug)}
                    className="flex-1 py-2 px-3 bg-zinc-800 hover:bg-zinc-700/80 text-zinc-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-zinc-700/60"
                  >
                    {copiedSlug === qrModalClient.slug ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Link Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-zinc-400" />
                        <span>Copiar link para enviar ao cliente</span>
                      </>
                    )}
                  </button>
                  <a
                    href={`/conectar/${qrModalClient.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-xl transition-colors border border-zinc-700/60"
                    title="Abrir tela cheia em nova aba"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 2: CADASTRO DE NOVO CLIENTE */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl animate-fade-in relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 p-2 text-zinc-400 hover:text-white rounded-xl bg-zinc-800/60 hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-xl font-bold text-white mb-2">Cadastrar Novo Cliente</h2>
            <p className="text-xs text-zinc-400 mb-6">
              Cadastre o cliente. Em seguida, o QR Code de conexão já abrirá na sua tela na hora!
            </p>

            {errorMessage && (
              <div className="mb-4 p-3 bg-red-950/60 border border-red-800/80 rounded-xl flex items-center gap-2 text-xs text-red-300">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{errorMessage}</span>
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
                  placeholder="Ex: Dra. Ana Santos ou Loja Alfa"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-colors"
                />
              </div>

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
                  Se você já criou a instância na Evolution API, digite o nome exato aqui!
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={creating}
                  className="px-4 py-2.5 text-xs text-zinc-400 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-black px-5 py-2.5 rounded-xl font-bold text-xs transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:opacity-50"
                >
                  {creating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    <>
                      <PlusCircle className="w-4 h-4" />
                      Cadastrar e Abrir QR Code
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
