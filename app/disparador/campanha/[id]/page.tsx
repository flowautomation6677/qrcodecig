'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, CheckCircle2, Clock, PlayCircle, XCircle, 
  Save, AlertTriangle, Users, Calendar, Settings, Trash2, PauseCircle 
} from 'lucide-react';

export default function CampanhaDetailsPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [campaign, setCampaign] = useState<any>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Edit form states
  const [name, setName] = useState('');
  const [messageTemplate, setMessageTemplate] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [delayMin, setDelayMin] = useState(15);
  const [delayMax, setDelayMax] = useState(45);
  const [batchSize, setBatchSize] = useState(40);
  const [batchPause, setBatchPause] = useState(10);
  
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success'|'error'} | null>(null);

  const showToast = (message: string, type: 'success'|'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    fetchCampaign();
    // Se a campanha estiver rodando, pode fazer um polling para atualizar os logs
    const interval = setInterval(() => {
      if (campaign && campaign.status === 'running') {
        fetchCampaign(false); // silencioso
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [params.id, campaign?.status]);

  const fetchCampaign = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch(`/api/campaign/${params.id}`);
      const data = await res.json();
      if (data.campaign) {
        setCampaign(data.campaign);
        setContacts(data.contacts || []);
        
        // Populate form if it's the first load
        if (showLoading) {
          setName(data.campaign.name || '');
          setMessageTemplate(data.campaign.messageTemplate || '');
          setDelayMin(data.campaign.delayMin || 15);
          setDelayMax(data.campaign.delayMax || 45);
          setBatchSize(data.campaign.batchSize || 40);
          setBatchPause(data.campaign.batchPause || 10);
          if (data.campaign.scheduledAt) {
            // Convert to local datetime-local format
            const d = new Date(data.campaign.scheduledAt);
            const tzOffset = d.getTimezoneOffset() * 60000;
            const localISOTime = (new Date(d.getTime() - tzOffset)).toISOString().slice(0, 16);
            setScheduledAt(localISOTime);
          }
        }
      }
    } catch (err) {
      console.error(err);
      showToast('Erro ao carregar campanha', 'error');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/campaign/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          messageTemplate,
          scheduledAt: scheduledAt || null,
          delayMin,
          delayMax,
          batchSize,
          batchPause
        })
      });
      if (res.ok) {
        showToast('Campanha atualizada com sucesso!', 'success');
        fetchCampaign(false);
      } else {
        showToast('Erro ao atualizar', 'error');
      }
    } catch (err) {
      showToast('Erro na requisição', 'error');
    }
    setSaving(false);
  };

  const handlePause = async () => {
    try {
      const res = await fetch(`/api/campaign/${params.id}/pause`, { method: 'POST' });
      if (res.ok) {
        showToast('Campanha pausada!', 'success');
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

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja excluir esta campanha?')) return;
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

  if (loading) {
    return (
      <div className="p-8 max-w-6xl mx-auto flex justify-center mt-20">
        <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="p-8 max-w-6xl mx-auto text-center mt-20">
        <h1 className="text-2xl font-bold text-white mb-4">Campanha não encontrada</h1>
        <button onClick={() => router.push('/disparador')} className="text-emerald-400 hover:underline">Voltar ao Dashboard</button>
      </div>
    );
  }

  const isEditable = ['pending', 'scheduled', 'paused'].includes(campaign.status);

  return (
    <div className="p-4 sm:p-8 max-w-[1600px] mx-auto text-white">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl transition-all animate-in fade-in slide-in-from-top-4 ${
          toast.type === 'error' ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
        }`}>
          {toast.type === 'error' ? <XCircle className="w-5 h-5"/> : <CheckCircle2 className="w-5 h-5"/>}
          <span className="font-medium text-sm">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <header className="flex items-center justify-between mb-8 pb-6 border-b border-zinc-800/80">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push('/disparador')}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
              {campaign.name}
              {campaign.status === 'completed' && <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">Concluída</span>}
              {campaign.status === 'running' && <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 animate-pulse">Rodando</span>}
              {campaign.status === 'scheduled' && <span className="text-xs px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">Agendada</span>}
              {campaign.status === 'paused' && <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">Pausada</span>}
            </h1>
            <p className="text-sm text-zinc-500 mt-1">Modo: <span className="uppercase text-zinc-300 font-bold">{campaign.messageMode}</span></p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {(campaign.status === 'running' || campaign.status === 'scheduled' || campaign.status === 'pending') && (
            <button 
              onClick={handlePause}
              className="flex items-center gap-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 px-4 py-2.5 rounded-xl font-bold transition-all text-sm"
            >
              <PauseCircle className="w-4 h-4" />
              Pausar
            </button>
          )}

          {campaign.status === 'paused' && (
            <button 
              onClick={handleResume}
              className="flex items-center gap-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 px-4 py-2.5 rounded-xl font-bold transition-all text-sm"
            >
              <PlayCircle className="w-4 h-4" />
              Retomar
            </button>
          )}

          {isEditable && (
            <button 
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black px-6 py-2.5 rounded-xl font-bold transition-all disabled:opacity-50 text-sm"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          )}

          <button 
            onClick={handleDelete}
            className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-4 py-2.5 rounded-xl font-bold transition-all text-sm"
          >
            <Trash2 className="w-4 h-4" />
            Excluir
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Col: Config & Edit */}
        <div className="lg:col-span-4 flex flex-col space-y-6">
          <div className="bg-zinc-900/40 p-6 rounded-3xl border border-zinc-800/60 shadow-xl">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-zinc-100 mb-6">
              <Settings className="w-5 h-5 text-emerald-400" />
              Configurações
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-2">Nome da Campanha</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={e => setName(e.target.value)}
                  disabled={!isEditable}
                  className="w-full bg-black/50 border border-zinc-700/50 rounded-xl p-3 text-sm text-zinc-200 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-2">Data de Agendamento</label>
                <input 
                  type="datetime-local" 
                  value={scheduledAt}
                  onChange={e => setScheduledAt(e.target.value)}
                  disabled={!isEditable}
                  className="w-full bg-black/50 border border-zinc-700/50 rounded-xl p-3 text-sm text-zinc-200 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-2">Mensagem ({campaign.messageMode})</label>
                <textarea 
                  value={messageTemplate}
                  onChange={e => setMessageTemplate(e.target.value)}
                  disabled={!isEditable}
                  rows={4}
                  className="w-full bg-black/50 border border-zinc-700/50 rounded-xl p-3 text-sm text-zinc-200 disabled:opacity-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-zinc-800">
                <div>
                  <label className="text-xs text-zinc-500 block mb-1">Delay Mín. (s)</label>
                  <input type="number" value={delayMin} onChange={e => setDelayMin(Number(e.target.value))} disabled={!isEditable} className="w-full bg-black/50 border border-zinc-800 rounded-lg p-2 text-sm text-zinc-300 disabled:opacity-50"/>
                </div>
                <div>
                  <label className="text-xs text-zinc-500 block mb-1">Delay Máx. (s)</label>
                  <input type="number" value={delayMax} onChange={e => setDelayMax(Number(e.target.value))} disabled={!isEditable} className="w-full bg-black/50 border border-zinc-800 rounded-lg p-2 text-sm text-zinc-300 disabled:opacity-50"/>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Stats & Logs */}
        <div className="lg:col-span-8 flex flex-col space-y-6">
          
          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-zinc-900/40 p-5 rounded-2xl border border-zinc-800/60">
              <p className="text-xs text-zinc-500 font-bold mb-1 uppercase">Total</p>
              <p className="text-2xl font-light text-white">{campaign.total}</p>
            </div>
            <div className="bg-zinc-900/40 p-5 rounded-2xl border border-emerald-500/20">
              <p className="text-xs text-emerald-500 font-bold mb-1 uppercase">Enviados</p>
              <p className="text-2xl font-light text-emerald-400">{campaign.sent}</p>
            </div>
            <div className="bg-zinc-900/40 p-5 rounded-2xl border border-red-500/20">
              <p className="text-xs text-red-500 font-bold mb-1 uppercase">Falhas</p>
              <p className="text-2xl font-light text-red-400">{campaign.failed}</p>
            </div>
          </div>

          {/* Logs */}
          <div className="bg-zinc-900/40 rounded-3xl border border-zinc-800/60 shadow-xl overflow-hidden flex-1">
            <div className="p-6 border-b border-zinc-800/60 bg-black/40 flex justify-between items-center">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-400" /> Relatório de Contatos
              </h2>
            </div>
            
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-left text-sm text-zinc-400">
                <thead className="text-xs uppercase bg-zinc-900/80 text-zinc-500 sticky top-0">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Contato</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold text-right">Data/Hora</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/40">
                  {contacts.map((c) => (
                    <tr key={c.id} className="hover:bg-zinc-800/20">
                      <td className="px-6 py-4">
                        <p className="font-bold text-zinc-200">{c.number}</p>
                        {c.name && <p className="text-xs text-zinc-500 mt-0.5">{c.name}</p>}
                      </td>
                      <td className="px-6 py-4">
                        {c.status === 'pending' && <span className="text-zinc-500 text-xs flex items-center gap-1"><Clock className="w-3 h-3"/> Pendente</span>}
                        {c.status === 'sent' && <span className="text-emerald-400 text-xs flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Enviado</span>}
                        {c.status === 'failed' && (
                          <div>
                            <span className="text-red-400 text-xs flex items-center gap-1"><XCircle className="w-3 h-3"/> Falha</span>
                            <span className="text-[10px] text-red-500/70 block mt-1">{c.error}</span>
                          </div>
                        )}
                        {(c.status === 'checking' || c.status === 'typing' || c.status === 'recording') && (
                          <span className="text-amber-400 text-xs flex items-center gap-1 animate-pulse"><PlayCircle className="w-3 h-3"/> Processando...</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right text-zinc-500 text-xs font-mono">
                        {c.sentAt ? new Date(c.sentAt).toLocaleString('pt-BR') : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
