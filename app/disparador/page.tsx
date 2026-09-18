'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { PlusCircle, Activity, Calendar, CheckCircle2, Clock, PlayCircle } from 'lucide-react';

interface Campaign {
  id: string;
  name: string;
  status: string;
  scheduledAt: string | null;
  createdAt: string;
  _count: {
    contacts: number;
  };
}

export default function DashboardPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/campaign')
      .then(res => res.json())
      .then(data => {
        if (data.campaigns) {
          setCampaigns(data.campaigns);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Erro ao buscar campanhas:', err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Painel de Campanhas</h1>
          <p className="text-sm text-zinc-400">Gerencie seus disparos e acompanhe os resultados em tempo real.</p>
        </div>
        <Link 
          href="/disparador/novo" 
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black px-6 py-3 rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)]"
        >
          <PlusCircle className="w-5 h-5" />
          Nova Campanha
        </Link>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20">
              <Activity className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-zinc-500 uppercase font-bold mb-1">Total de Campanhas</p>
              <p className="text-3xl font-light text-white">{campaigns.length}</p>
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
              <p className="text-3xl font-light text-white">{campaigns.filter(c => c.status === 'completed').length}</p>
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
              <p className="text-3xl font-light text-white">{campaigns.filter(c => c.status === 'running').length}</p>
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
              <p className="text-3xl font-light text-white">{campaigns.filter(c => c.status === 'scheduled').length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Campaigns List */}
      <div className="bg-zinc-900/40 rounded-3xl border border-zinc-800/60 shadow-xl overflow-hidden">
        <div className="p-6 border-b border-zinc-800/60 bg-black/40">
          <h2 className="text-lg font-bold text-white">Últimas Campanhas</h2>
        </div>
        
        {loading ? (
          <div className="p-12 flex justify-center">
            <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="p-12 text-center">
            <Calendar className="w-16 h-16 text-zinc-800 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-zinc-300 mb-2">Nenhuma campanha criada</h3>
            <p className="text-zinc-500 mb-6">Você ainda não criou nenhuma campanha de disparo.</p>
            <Link 
              href="/disparador/novo" 
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
                  <th className="px-6 py-4 font-semibold">Nome da Campanha</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Contatos</th>
                  <th className="px-6 py-4 font-semibold">Agendamento</th>
                  <th className="px-6 py-4 font-semibold text-right">Data de Criação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {campaigns.map((camp) => (
                  <tr key={camp.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold text-zinc-200">{camp.name}</p>
                      <p className="text-xs font-mono text-zinc-600 mt-1">ID: {camp.id.substring(0, 8)}</p>
                    </td>
                    <td className="px-6 py-4">
                      {camp.status === 'pending' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-800 text-zinc-400"><Clock className="w-3.5 h-3.5"/> Pendente</span>}
                      {camp.status === 'scheduled' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20"><Calendar className="w-3.5 h-3.5"/> Agendada</span>}
                      {camp.status === 'running' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 animate-pulse"><PlayCircle className="w-3.5 h-3.5"/> Rodando</span>}
                      {camp.status === 'paused' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">Pausada</span>}
                      {camp.status === 'completed' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20"><CheckCircle2 className="w-3.5 h-3.5"/> Concluída</span>}
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
