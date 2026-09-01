'use client';

import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { Play, Pause, Square, Upload, Users, Clock, AlertTriangle, CheckCircle2, XCircle, Send } from 'lucide-react';

interface Contact {
  number: string;
  name?: string;
  [key: string]: any;
}

interface CampaignStatus {
  status: 'idle' | 'running' | 'paused' | 'completed';
  total: number;
  sent: number;
  failed: number;
  currentContactIndex: number;
}

interface LogEntry {
  number: string;
  name?: string;
  status: 'pending' | 'checking' | 'typing' | 'sent' | 'failed';
  error?: string;
  time?: string;
}

// Spintax parser: {Olá|Oi|Opa}
const parseSpintax = (text: string) => {
  let parsed = text;
  const regex = /\{([^{}]+)\}/g;
  let match;
  while ((match = regex.exec(parsed)) !== null) {
    const options = match[1].split('|');
    const randomOption = options[Math.floor(Math.random() * options.length)];
    parsed = parsed.replace(match[0], randomOption);
    regex.lastIndex = 0; // reset to avoid infinite loop on newly injected spintax if nested (though nested isn't supported here)
  }
  return parsed;
};

// Replace variables: {nome}
const injectVariables = (text: string, contact: Contact) => {
  let result = text;
  Object.keys(contact).forEach((key) => {
    // eslint-disable-next-line
    const regex = new RegExp(String.raw`\{${key}\}`, 'gi');
    result = result.replace(regex, contact[key] || '');
  });
  return result;
};

export default function Broadcaster({ instanceName }: Readonly<{ instanceName: string }>) {
  const [inputText, setInputText] = useState('');
  const [messageTemplate, setMessageTemplate] = useState('Olá {nome}, tudo bem?\n\n{Aqui é|Fala com} o time da Flowrocket.');
  
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  
  const [minDelay, setMinDelay] = useState(15);
  const [maxDelay, setMaxDelay] = useState(45);
  const [batchSize, setBatchSize] = useState(40);
  const [batchPause, setBatchPause] = useState(10); // minutes
  
  const [campaign, setCampaign] = useState<CampaignStatus>({
    status: 'idle',
    total: 0,
    sent: 0,
    failed: 0,
    currentContactIndex: 0
  });

  const campaignRef = useRef(campaign);
  campaignRef.current = campaign;

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const updateLog = (index: number, update: Partial<LogEntry>) => {
    setLogs(prev => {
      const newLogs = [...prev];
      newLogs[index] = { ...newLogs[index], ...update, time: new Date().toLocaleTimeString() };
      return newLogs;
    });
  };

  const processInput = () => {
    if (!inputText.trim()) return;
    
    // Try CSV parsing first
    Papa.parse(inputText, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        let parsedContacts: Contact[] = [];
        
        // Se tiver cabeçalho 'number' ou 'numero'
        if (results.meta.fields && (results.meta.fields.includes('number') || results.meta.fields.includes('numero') || results.meta.fields.includes('telefone'))) {
           parsedContacts = results.data.map((row: any) => ({
             ...row,
             number: row.number || row.numero || row.telefone || ''
           })).filter((c: any) => c.number);
        } else {
           // Fallback para lista de números pura
           const lines = inputText.split('\n').map(l => l.trim()).filter(Boolean);
           parsedContacts = lines.map(line => {
             const parts = line.split(',');
             return { number: parts[0], name: parts[1] || '' };
           });
        }
        
        // Clean numbers
        parsedContacts = parsedContacts.map(c => ({
          ...c,
          number: c.number.replace(/\D/g, '')
        })).filter(c => c.number.length >= 10);
        
        setContacts(parsedContacts);
        setLogs(parsedContacts.map(c => ({ number: c.number, name: c.name, status: 'pending' })));
        setCampaign(prev => ({ ...prev, total: parsedContacts.length, status: 'idle', currentContactIndex: 0, sent: 0, failed: 0 }));
      }
    });
  };

  const checkWhatsAppNumber = async (number: string, index: number): Promise<boolean> => {
    updateLog(index, { status: 'checking' });
    try {
      const checkRes = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check', number, instance: instanceName })
      });
      const checkData = await checkRes.json();
      if (!checkData.exists) {
        updateLog(index, { status: 'failed', error: 'Número não possui WhatsApp' });
        return false;
      }
    } catch (e) {
      // Ignore
    }
    return true;
  };

  const sendPresenceAndMessage = async (contact: Contact, text: string, index: number): Promise<boolean> => {
    const typingDelay = Math.min(Math.max(text.length * 50, 3000), 12000);
    
    updateLog(index, { status: 'typing' });
    await fetch('/api/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'presence', number: contact.number, instance: instanceName, delay: typingDelay })
    });

    await delay(typingDelay);
    if (campaignRef.current.status !== 'running') return false;

    try {
      const sendRes = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sendText', number: contact.number, message: text, instance: instanceName })
      });
      
      if (sendRes.ok) {
         updateLog(index, { status: 'sent' });
         return true;
      } else {
         const err = await sendRes.json();
         updateLog(index, { status: 'failed', error: err.error || 'Falha no envio' });
         return false;
      }
    } catch (e: any) {
      updateLog(index, { status: 'failed', error: e.message });
      return false;
    }
  };

  const handleCampaignCadence = async (index: number) => {
    const isBatchEnd = (index + 1) % batchSize === 0;
    if (isBatchEnd) {
       updateLog(index, { error: `Pausa de lote: ${batchPause} min...` });
       await delay(batchPause * 60 * 1000);
    } else {
       // eslint-disable-next-line
       const waitSeconds = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
       await delay(waitSeconds * 1000);
    }
  };

  const startCampaign = async () => {
    if (contacts.length === 0) return;
    
    setCampaign(prev => ({ ...prev, status: 'running' }));
    
    for (let i = campaignRef.current.currentContactIndex; i < contacts.length; i++) {
      if (campaignRef.current.status !== 'running') break;
      
      const contact = contacts[i];
      const hasWhatsApp = await checkWhatsAppNumber(contact.number, i);
      
      if (!hasWhatsApp) {
        setCampaign(prev => ({ ...prev, failed: prev.failed + 1, currentContactIndex: i + 1 }));
        continue;
      }
      
      if (campaignRef.current.status !== 'running') break;

      const finalText = parseSpintax(injectVariables(messageTemplate, contact));
      const success = await sendPresenceAndMessage(contact, finalText, i);

      setCampaign(prev => ({ 
        ...prev, 
        sent: prev.sent + (success ? 1 : 0),
        failed: prev.failed + (success ? 0 : 1),
        currentContactIndex: i + 1 
      }));

      if (i === contacts.length - 1) {
        setCampaign(prev => ({ ...prev, status: 'completed' }));
        break;
      }

      if (campaignRef.current.status === 'running') {
        await handleCampaignCadence(i);
      }
    }
  };

  const pauseCampaign = () => setCampaign(prev => ({ ...prev, status: 'paused' }));
  const stopCampaign = () => setCampaign(prev => ({ ...prev, status: 'idle', currentContactIndex: 0, sent: 0, failed: 0 }));

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8 font-sans selection:bg-emerald-500/30">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent flex items-center gap-3">
              <Send className="w-8 h-8 text-emerald-400" />
              NEXUS Messenger
            </h1>
            <p className="text-zinc-400 mt-2">Disparador de Alta Conversão & Anti-Ban via Evolution API</p>
          </div>
          <div className="flex items-center gap-4 bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800/50 backdrop-blur-xl">
             <div className="text-right">
               <p className="text-sm text-zinc-400">Instância Conectada</p>
               <p className="font-medium text-emerald-400">{instanceName || 'Aguardando...'}</p>
             </div>
             <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.5)]"></div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column - Config */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Contacts Input */}
            <div className="bg-zinc-900/40 p-6 rounded-3xl border border-zinc-800/60 backdrop-blur-md shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-zinc-800 to-zinc-700 group-hover:from-emerald-500 group-hover:to-cyan-500 transition-all duration-500"></div>
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-4 text-zinc-100">
                <Users className="w-5 h-5 text-emerald-400" />
                Destinatários (CSV ou Números)
              </h2>
              <textarea 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Ex: 551199999999,João&#10;551188888888,Maria"
                className="w-full h-40 bg-black/50 border border-zinc-700/50 rounded-xl p-4 text-sm text-zinc-300 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all resize-none placeholder:text-zinc-600 font-mono"
                disabled={campaign.status === 'running' || campaign.status === 'paused'}
              />
              <button 
                onClick={processInput}
                disabled={campaign.status === 'running' || !inputText.trim()}
                className="mt-4 w-full bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                Processar Contatos
              </button>
            </div>

            {/* Message Composer */}
            <div className="bg-zinc-900/40 p-6 rounded-3xl border border-zinc-800/60 backdrop-blur-md shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-zinc-800 to-zinc-700 group-hover:from-emerald-500 group-hover:to-cyan-500 transition-all duration-500"></div>
              <h2 className="text-lg font-semibold mb-4 text-zinc-100">Compositor (Spintax Suportado)</h2>
              <p className="text-xs text-zinc-500 mb-3 font-mono bg-black/30 p-2 rounded-lg">Uso: &#123;nome&#125; ou &#123;Olá|Oi|Opa&#125;</p>
              <textarea 
                value={messageTemplate}
                onChange={(e) => setMessageTemplate(e.target.value)}
                className="w-full h-40 bg-black/50 border border-zinc-700/50 rounded-xl p-4 text-sm text-zinc-300 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all resize-none"
                disabled={campaign.status === 'running' || campaign.status === 'paused'}
              />
            </div>

            {/* Settings */}
            <div className="bg-zinc-900/40 p-6 rounded-3xl border border-zinc-800/60 backdrop-blur-md shadow-2xl relative overflow-hidden">
               <h2 className="text-lg font-semibold flex items-center gap-2 mb-6 text-zinc-100">
                <Clock className="w-5 h-5 text-emerald-400" />
                Cadência Anti-Ban
              </h2>
              
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-sm mb-2 text-zinc-400">
                    <label htmlFor="minDelay">Delay Mínimo (seg)</label>
                    <span className="text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded-md">{minDelay}s</span>
                  </div>
                  <input id="minDelay" type="range" min="5" max="120" value={minDelay} onChange={e => setMinDelay(Number(e.target.value))} className="w-full accent-emerald-500" disabled={campaign.status !== 'idle'}/>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2 text-zinc-400">
                    <label htmlFor="maxDelay">Delay Máximo (seg)</label>
                    <span className="text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded-md">{maxDelay}s</span>
                  </div>
                  <input id="maxDelay" type="range" min="15" max="300" value={maxDelay} onChange={e => setMaxDelay(Number(e.target.value))} className="w-full accent-emerald-500" disabled={campaign.status !== 'idle'}/>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-800/50">
                   <div>
                     <label htmlFor="batchSize" className="text-xs text-zinc-500 block mb-1">Pausa Lote (Msg)</label>
                     <input id="batchSize" type="number" value={batchSize} onChange={e => setBatchSize(Number(e.target.value))} className="w-full bg-black/50 border border-zinc-700/50 rounded-lg p-2 text-sm text-center" disabled={campaign.status !== 'idle'}/>
                   </div>
                   <div>
                     <label htmlFor="batchPause" className="text-xs text-zinc-500 block mb-1">Tempo Pausa (Min)</label>
                     <input id="batchPause" type="number" value={batchPause} onChange={e => setBatchPause(Number(e.target.value))} className="w-full bg-black/50 border border-zinc-700/50 rounded-lg p-2 text-sm text-center" disabled={campaign.status !== 'idle'}/>
                   </div>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column - Status & Logs */}
          <div className="lg:col-span-8 flex flex-col space-y-6">
            
            {/* Main Control Panel */}
            <div className="bg-gradient-to-br from-zinc-900 to-black p-8 rounded-3xl border border-zinc-800 shadow-2xl relative overflow-hidden">
               {/* Progress Bar Background */}
               <div className="absolute bottom-0 left-0 h-1 bg-zinc-800 w-full">
                  <div className="h-full bg-emerald-500 transition-all duration-1000 ease-out shadow-[0_0_20px_rgba(16,185,129,0.8)]" style={{ width: `${campaign.total ? (campaign.currentContactIndex / campaign.total) * 100 : 0}%` }}></div>
               </div>

               <div className="flex items-center justify-between">
                 <div>
                   <h2 className="text-2xl font-bold mb-1 text-white">Progresso da Campanha</h2>
                   <p className="text-zinc-400 flex items-center gap-2">
                     Status: 
                     {campaign.status === 'idle' && <span className="text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full text-sm">Aguardando</span>}
                     {campaign.status === 'running' && <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full text-sm animate-pulse flex items-center gap-1"><span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>Disparando</span>}
                     {campaign.status === 'paused' && <span className="text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full text-sm">Pausado</span>}
                     {campaign.status === 'completed' && <span className="text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full text-sm">Concluído</span>}
                   </p>
                 </div>
                 
                 <div className="flex gap-4">
                   <div className="text-center px-6 py-3 bg-black/40 rounded-2xl border border-zinc-800/50">
                     <p className="text-4xl font-light text-white">{campaign.total}</p>
                     <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mt-1">Total</p>
                   </div>
                   <div className="text-center px-6 py-3 bg-emerald-500/5 rounded-2xl border border-emerald-500/20">
                     <p className="text-4xl font-light text-emerald-400">{campaign.sent}</p>
                     <p className="text-xs text-emerald-500/70 font-medium uppercase tracking-wider mt-1">Enviados</p>
                   </div>
                   <div className="text-center px-6 py-3 bg-red-500/5 rounded-2xl border border-red-500/20">
                     <p className="text-4xl font-light text-red-400">{campaign.failed}</p>
                     <p className="text-xs text-red-500/70 font-medium uppercase tracking-wider mt-1">Falhas</p>
                   </div>
                 </div>
               </div>

               <div className="flex gap-4 mt-8">
                 {campaign.status === 'idle' || campaign.status === 'paused' ? (
                   <button 
                     onClick={startCampaign}
                     disabled={contacts.length === 0}
                     className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black py-4 rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] flex items-center justify-center gap-2 disabled:opacity-50 disabled:shadow-none"
                   >
                     <Play className="w-5 h-5" fill="currentColor"/> {campaign.status === 'paused' ? 'Retomar Disparo' : 'Iniciar Campanha'}
                   </button>
                 ) : (
                   <button 
                     onClick={pauseCampaign}
                     className="flex-1 bg-amber-500 hover:bg-amber-400 text-black py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                   >
                     <Pause className="w-5 h-5" fill="currentColor"/> Pausar Disparo
                   </button>
                 )}
                 <button 
                   onClick={stopCampaign}
                   disabled={campaign.status === 'idle'}
                   className="px-8 bg-zinc-800 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 text-white py-4 rounded-xl font-bold transition-all border border-zinc-700 flex items-center justify-center gap-2 disabled:opacity-50"
                 >
                   <Square className="w-5 h-5" fill="currentColor"/> Parar
                 </button>
               </div>
            </div>

            {/* Live Table */}
            <div className="flex-1 bg-zinc-900/40 rounded-3xl border border-zinc-800/60 backdrop-blur-md shadow-2xl flex flex-col overflow-hidden">
               <div className="p-4 border-b border-zinc-800/50 bg-black/20 flex justify-between items-center">
                 <h3 className="font-semibold text-zinc-300 flex items-center gap-2">
                   Log de Operações
                   {campaign.status === 'running' && <span className="flex gap-1 items-center ml-2"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce"></span><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></span><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></span></span>}
                 </h3>
               </div>
               
               <div className="flex-1 overflow-auto p-2" style={{ maxHeight: '400px' }}>
                 {logs.length === 0 ? (
                   <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-4">
                     <AlertTriangle className="w-12 h-12 opacity-20" />
                     <p>Nenhum contato processado ainda.</p>
                   </div>
                 ) : (
                   <table className="w-full text-left text-sm text-zinc-400">
                     <thead className="text-xs uppercase bg-black/40 text-zinc-500 sticky top-0">
                       <tr>
                         <th className="px-4 py-3 rounded-l-lg">Destinatário</th>
                         <th className="px-4 py-3">Status</th>
                         <th className="px-4 py-3 text-right">Hora</th>
                         <th className="px-4 py-3 rounded-r-lg">Detalhe</th>
                       </tr>
                     </thead>
                     <tbody>
                       {logs.map((log, idx) => (
                         <tr key={`${log.number}-${idx}`} className={`border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors ${idx === campaign.currentContactIndex && campaign.status === 'running' ? 'bg-zinc-800/40' : ''}`}>
                           <td className="px-4 py-3 font-mono text-zinc-300">
                             {log.number}
                             {log.name && <span className="ml-2 text-xs bg-zinc-800 px-2 py-0.5 rounded-full text-zinc-400">{log.name}</span>}
                           </td>
                           <td className="px-4 py-3">
                             {log.status === 'pending' && <span className="text-zinc-600">Pendente</span>}
                             {log.status === 'checking' && <span className="text-cyan-400 animate-pulse">Validando...</span>}
                             {log.status === 'typing' && <span className="text-purple-400 animate-pulse">Digitando...</span>}
                             {log.status === 'sent' && <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-4 h-4"/> Enviado</span>}
                             {log.status === 'failed' && <span className="text-red-400 flex items-center gap-1"><XCircle className="w-4 h-4"/> Falha</span>}
                           </td>
                           <td className="px-4 py-3 text-right font-mono text-xs">{log.time || '-'}</td>
                           <td className="px-4 py-3 text-xs opacity-70 truncate max-w-[150px]">{log.error || 'ok'}</td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 )}
               </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
