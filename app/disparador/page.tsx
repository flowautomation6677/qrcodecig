'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  PlusCircle,
  Activity,
  Calendar,
  CheckCircle2,
  Clock,
  PlayCircle,
  Users,
  Filter,
  Smartphone,
} from 'lucide-react';

interface Campaign {
  id: string;
  name: string;
  status: string;
  instanceName: string;
  scheduledAt: string | null;
  createdAt: string;
  clientId?: string | null;
  client?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  _count: {
    contacts: number;
  };
}

interface ClientOption {
  id: string;
  name: string;
  instanceName: string;
  status: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [stats, setStats] = useState({ total: 0, completed: 0, running: 0, scheduled: 0 });
  const [loading, setLoading] = useState(true);

  // 1. Carrega lista de clientes para o filtro
  useEffect(() => {
    fetch('/api/clients')
      .then((res) => res.json())
      .then((data) => {
        if (data.clients) {
          setClients(data.clients);
        }
      })
      .catch((err) => console.error('Erro ao buscar clientes:', err));
  }, []);

  // 2. Carrega campanhas (com ou sem filtro de cliente)
  const fetchCampaigns = (clientId: string) => {
    setLoading(true);
    const url = clientId ? `/api/campaign?clientId=${encodeURIComponent(clientId)}` : '/api/campaign';

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (data.campaigns) {
          setCampaigns(data.campaigns);
        }
        if (data.stats) {
          setStats(data.stats);
        } else if (data.campaigns) {
          setStats({
            total: data.campaigns.length,
            completed: data.campaigns.filter((c: any) => c.status === 'completed').length,
            running: data.campaigns.filter((c: any) => c.status === 'running').length,
            scheduled: data.campaigns.filter((c: any) => c.status === 'scheduled').length,
          });
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Erro ao buscar campanhas:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchCampaigns(selectedClientId);
  }, [selectedClientId]);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Painel de Campanhas</h1>
          <p className="text-sm text-zinc-400">Gerencie seus disparos e acompanhe os resultados em tempo real.</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Seletor / Filtro por Cliente */}
          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs">
            <Filter className="w-4 h-4 text-zinc-400" />
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
            >
              <option value="" className="bg-zinc-900 text-white">Todos os Clientes</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id} className="bg-zinc-900 text-white">
                  {c.name} {c.status === 'connected' ? '🟢' : '🔴'}
                </option>
              ))}
            </select>
          </div>

          <Link
            href={selectedClientId ? `/disparador/novo?clientId=${selectedClientId}` : '/disparador/novo'}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black px-5 py-2.5 rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] text-sm"
          >
            <PlusCircle className="w-5 h-5" />
            Nova Campanha
          </Link>
        </div>
      </header>

      {/* Seletor Rápido de Clientes para Disparo */}
      <div className="mb-8 bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-5 shadow-xl backdrop-blur-sm">
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Disparar por Cliente:
            </h2>
          </div>
          <Link
            href="/disparador/clientes"
            className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold hover:underline flex items-center gap-1"
          >
            Ver todos / Gerenciar &rarr;
          </Link>
        </div>

        {clients.length === 0 ? (
          <div className="p-4 text-center text-xs text-zinc-500 border border-zinc-800/80 rounded-2xl bg-black/30">
            Nenhum cliente cadastrado.{' '}
            <Link href="/disparador/clientes" className="text-emerald-400 font-bold hover:underline">
              Cadastrar cliente agora
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {clients.map((c) => {
              const isSelected = selectedClientId === c.id;
              const isConnected = c.status === 'connected';

              return (
                <div
                  key={c.id}
                  className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'bg-emerald-950/30 border-emerald-500/60 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                      : 'bg-black/40 border-zinc-800/80 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="font-bold text-sm text-white truncate" title={c.name}>
                      {c.name}
                    </p>
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        isConnected ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-red-500'
                      }`}
                      title={isConnected ? 'Conectado' : 'Desconectado'}
                    />
                  </div>
                  <p className="text-[11px] font-mono text-zinc-500 truncate mb-3">
                    {c.instanceName}
                  </p>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/disparador/novo?clientId=${c.id}`}
                      className="flex-1 py-1.5 px-2 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold rounded-xl text-xs text-center transition-all shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                    >
                      Disparar
                    </Link>
                    <button
                      onClick={() => setSelectedClientId(isSelected ? '' : c.id)}
                      className={`px-2 py-1.5 rounded-xl text-xs font-semibold transition-colors border ${
                        isSelected
                          ? 'bg-zinc-800 text-white border-zinc-700'
                          : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
                      }`}
                      title={isSelected ? 'Limpar filtro' : 'Filtrar campanhas'}
                    >
                      {isSelected ? 'Filtro Ativo' : 'Filtrar'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20">
              <Activity className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-zinc-500 uppercase font-bold mb-1">Total de Campanhas</p>
              <p className="text-3xl font-light text-white">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-zinc-500 uppercase font-bold mb-1">Concluídas</p>
              <p className="text-3xl font-light text-white">{stats.completed}</p>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center border border-amber-500/20">
              <PlayCircle className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-zinc-500 uppercase font-bold mb-1">Em Andamento</p>
              <p className="text-3xl font-light text-white">{stats.running}</p>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center border border-purple-500/20">
              <Calendar className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <p className="text-xs text-zinc-500 uppercase font-bold mb-1">Agendadas</p>
              <p className="text-3xl font-light text-white">{stats.scheduled}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Campaigns List */}
      <div className="bg-zinc-900/40 rounded-3xl border border-zinc-800/60 shadow-xl overflow-hidden">
        <div className="p-6 border-b border-zinc-800/60 bg-black/40 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">
            {selectedClientId
              ? `Campanhas: ${clients.find((c) => c.id === selectedClientId)?.name || 'Cliente'}`
              : 'Últimas Campanhas (Todos os Clientes)'}
          </h2>
          {selectedClientId && (
            <button
              onClick={() => setSelectedClientId('')}
              className="text-xs text-emerald-400 hover:underline"
            >
              Limpar filtro
            </button>
          )}
        </div>

        {loading ? (
          <div className="p-12 flex justify-center">
            <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="p-12 text-center">
            <Calendar className="w-16 h-16 text-zinc-800 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-zinc-300 mb-2">Nenhuma campanha encontrada</h3>
            <p className="text-zinc-500 mb-6">
              {selectedClientId
                ? 'Este cliente ainda não possui nenhuma campanha de disparo.'
                : 'Você ainda não criou nenhuma campanha de disparo.'}
            </p>
            <Link
              href={selectedClientId ? `/disparador/novo?clientId=${selectedClientId}` : '/disparador/novo'}
              className="inline-flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white px-6 py-2.5 rounded-xl font-medium transition-all"
            >
              Criar Primeira Campanha
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-400">
              <thead className="text-xs uppercase bg-black/20 text-zinc-500">
                <tr>
                  <th className="px-6 py-4 font-semibold">Campanha</th>
                  <th className="px-6 py-4 font-semibold">Cliente / Chip</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Contatos</th>
                  <th className="px-6 py-4 font-semibold">Agendamento</th>
                  <th className="px-6 py-4 font-semibold text-right">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {campaigns.map((camp) => (
                  <tr
                    key={camp.id}
                    onClick={() => router.push(`/disparador/campanha/${camp.id}`)}
                    className="hover:bg-zinc-800/30 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <p className="font-bold text-zinc-200">{camp.name}</p>
                      <p className="text-xs font-mono text-zinc-600 mt-0.5">ID: {camp.id.substring(0, 8)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-emerald-400 shrink-0" />
                        <div>
                          <p className="text-xs font-bold text-zinc-200">
                            {camp.client?.name || 'Cliente'}
                          </p>
                          <p className="text-[11px] font-mono text-zinc-500">{camp.instanceName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {camp.status === 'pending' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-800 text-zinc-400">
                          <Clock className="w-3.5 h-3.5" /> Pendente
                        </span>
                      )}
                      {camp.status === 'scheduled' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                          <Calendar className="w-3.5 h-3.5" /> Agendada
                        </span>
                      )}
                      {camp.status === 'running' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 animate-pulse">
                          <PlayCircle className="w-3.5 h-3.5" /> Rodando
                        </span>
                      )}
                      {camp.status === 'paused' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          Pausada
                        </span>
                      )}
                      {camp.status === 'completed' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Concluída
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-zinc-300">{camp._count.contacts}</span>
                    </td>
                    <td className="px-6 py-4 text-zinc-300">
                      {camp.scheduledAt ? new Date(camp.scheduledAt).toLocaleString('pt-BR') : 'Imediato'}
                    </td>
                    <td className="px-6 py-4 text-right text-zinc-500">
                      {new Date(camp.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
