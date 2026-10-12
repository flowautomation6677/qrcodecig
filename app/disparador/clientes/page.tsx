'use client';

import React, { useEffect, useState } from 'react';
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
            Selecione o cliente abaixo para iniciar um disparo imediato com o chip dele ou gerenciar a conexão do WhatsApp.
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
            Cadastre o seu primeiro cliente ou empresa para gerar o link de conexão do chip e disparar campanhas por ele!
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
              {clients.length} {clients.length === 1 ? 'cliente disponível' : 'clientes disponíveis'}
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
                    className={`absolute top-0 left-0 right-0 h-1 ${
                      isConnected
                        ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600'
                        : 'bg-zinc-800'
                    }`}
                  />

                  {/* Informações do Cliente */}
                  <div>
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex items-center gap-3.5">
                        <div
                          className={`w-13 h-13 rounded-2xl flex items-center justify-center border font-bold text-lg shadow-inner shrink-0 ${
                            isConnected
                              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                              : 'bg-zinc-800/80 border-zinc-700 text-zinc-400'
                          }`}
                        >
                          <Smartphone className="w-6 h-6" />
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
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold shrink-0 border ${
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
                          campanhas
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
                    {/* BOTÃO PRINCIPAL: Fazer Disparo por este Cliente */}
                    <Link
                      href={`/disparador/novo?clientId=${client.id}`}
                      className="w-full flex items-center justify-center gap-2.5 py-3.5 px-5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-black font-extrabold rounded-2xl text-sm transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] active:scale-[0.99]"
                    >
                      <Send className="w-4 h-4" />
                      <span>Fazer Disparo com este Cliente</span>
                    </Link>

                    {/* Ações Secundárias */}
                    <div className="flex items-center gap-2 pt-1">
                      {/* Botão de Conexão do QR */}
                      <a
                        href={`/conectar/${client.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-zinc-800 hover:bg-zinc-700/80 text-zinc-200 rounded-xl text-xs font-semibold transition-all border border-zinc-700/60"
                        title="Abrir tela de QR Code para conectar WhatsApp"
                      >
                        <QrCode className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Escanear QR</span>
                        <ExternalLink className="w-3 h-3 text-zinc-400" />
                      </a>

                      {/* Botão Copiar Link */}
                      <button
                        onClick={() => handleCopyLink(client.slug)}
                        className="flex items-center justify-center gap-1.5 py-2 px-3 bg-zinc-800 hover:bg-zinc-700/80 text-zinc-200 rounded-xl text-xs font-semibold transition-all border border-zinc-700/60"
                        title="Copiar link para enviar ao cliente conectar"
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
                        title="Ver campanhas e relatórios deste cliente"
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

      {/* Modal / Cadastro de Novo Cliente */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl animate-fade-in">
            <h2 className="text-xl font-bold text-white mb-2">Cadastrar Novo Cliente</h2>
            <p className="text-xs text-zinc-400 mb-6">
              O sistema criará o link exclusivo do QR Code para o cliente conectar o WhatsApp.
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
                  Nome da Instância (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Deixe em branco para gerar automaticamente"
                  value={newInstanceName}
                  onChange={(e) => setNewInstanceName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-colors font-mono text-xs"
                />
                <p className="text-[11px] text-zinc-500 mt-1">
                  Se você já tem uma instância criada na Evolution API, digite o nome exato aqui!
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
                  className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black px-5 py-2.5 rounded-xl font-bold text-xs transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:opacity-50"
                >
                  {creating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    <>
                      <PlusCircle className="w-4 h-4" />
                      Cadastrar e Gerar Link
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
