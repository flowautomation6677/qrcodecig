'use client';

import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { 
  Play, Pause, Square, Upload, Users, Clock, AlertTriangle, 
  CheckCircle2, XCircle, Send, MessageSquare, Image as ImageIcon, 
  Mic, MicOff, Trash2, Volume2, Sparkles, FileAudio, Link as LinkIcon,
  Check
} from 'lucide-react';

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
  type: 'text' | 'image' | 'audio';
  status: 'pending' | 'checking' | 'typing' | 'recording' | 'sent' | 'failed';
  error?: string;
  time?: string;
}

type MessageMode = 'text' | 'image' | 'audio';

// Spintax parser: {Olá|Oi|Opa}
const parseSpintax = (text: string) => {
  if (!text) return '';
  let parsed = text;
  const regex = /\{([^{}]+)\}/g;
  let match;
  while ((match = regex.exec(parsed)) !== null) {
    const options = match[1].split('|');
    const randomOption = options[Math.floor(Math.random() * options.length)];
    parsed = parsed.replace(match[0], randomOption);
    regex.lastIndex = 0;
  }
  return parsed;
};

// Replace variables: {nome}
const injectVariables = (text: string, contact: Contact) => {
  if (!text) return '';
  let result = text;
  Object.keys(contact).forEach((key) => {
    // eslint-disable-next-line
    const regex = new RegExp(String.raw`\{${key}\}`, 'gi');
    result = result.replace(regex, contact[key] || '');
  });
  return result;
};

export default function Broadcaster({ instanceName }: Readonly<{ instanceName: string }>) {
  // Mode selection
  const [messageMode, setMessageMode] = useState<MessageMode>('text');

  // Text / Caption template
  const [inputText, setInputText] = useState('');
  const [messageTemplate, setMessageTemplate] = useState('Olá {nome}, tudo bem?\n\n{Aqui é|Fala com} o time da Flowrocket.');
  
  // Image State
  const [imageBase64, setImageBase64] = useState<string>('');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [imageFileName, setImageFileName] = useState<string>('');
  const [imageInputMethod, setImageInputMethod] = useState<'upload' | 'url'>('upload');

  // Audio State
  const [audioBase64, setAudioBase64] = useState<string>('');
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [audioFileName, setAudioFileName] = useState<string>('');
  const [audioInputMethod, setAudioInputMethod] = useState<'record' | 'upload' | 'url'>('record');
  const [isPtt, setIsPtt] = useState<boolean>(true); // Enviar como nota de voz gravada

  // Audio Recording State
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingTime, setRecordingTime] = useState<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Contacts and logs
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  
  // Cadence config
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

  // Process CSV or raw numbers
  const processInput = () => {
    if (!inputText.trim()) return;
    
    Papa.parse(inputText, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        let parsedContacts: Contact[] = [];
        
        if (results.meta.fields && (results.meta.fields.includes('number') || results.meta.fields.includes('numero') || results.meta.fields.includes('telefone'))) {
           parsedContacts = results.data.map((row: any) => ({
             ...row,
             number: row.number || row.numero || row.telefone || ''
           })).filter((c: any) => c.number);
        } else {
           const lines = inputText.split('\n').map(l => l.trim()).filter(Boolean);
           parsedContacts = lines.map(line => {
             const parts = line.split(',');
             return { number: parts[0], name: parts[1] || '' };
           });
        }
        
        parsedContacts = parsedContacts.map(c => ({
          ...c,
          number: String(c.number).replace(/\D/g, '')
        })).filter(c => c.number.length >= 10);
        
        setContacts(parsedContacts);
        setLogs(parsedContacts.map(c => ({ number: c.number, name: c.name, type: messageMode, status: 'pending' })));
        setCampaign(prev => ({ ...prev, total: parsedContacts.length, status: 'idle', currentContactIndex: 0, sent: 0, failed: 0 }));
      }
    });
  };

  // Image Upload Handler
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione um arquivo de imagem válido (JPG, PNG, WebP, etc).');
      return;
    }

    setImageFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      setImageBase64(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Audio Upload Handler
  const handleAudioFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAudioFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      setAudioBase64(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Audio Recording Handlers
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/ogg; codecs=opus' });
        const reader = new FileReader();
        reader.onloadend = () => {
          setAudioBase64(reader.result as string);
          setAudioFileName(`gravacao_${new Date().toISOString().slice(11, 19).replace(/:/g, '-')}.ogg`);
        };
        reader.readAsDataURL(audioBlob);

        // Stop all audio tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err: any) {
      alert('Não foi possível acessar o microfone: ' + (err.message || 'Permissão negada.'));
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const insertVariable = (variable: string) => {
    setMessageTemplate(prev => prev + variable);
  };

  // Check WhatsApp Number
  const checkWhatsAppNumber = async (number: string, index: number): Promise<boolean> => {
    updateLog(index, { status: 'checking', type: messageMode });
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

  // Send message according to selected mode
  const sendPresenceAndMessage = async (contact: Contact, text: string, index: number): Promise<boolean> => {
    const isAudio = messageMode === 'audio';
    const typingDelay = isAudio 
      ? Math.min(Math.max((recordingTime || 5) * 1000, 3000), 15000)
      : Math.min(Math.max(text.length * 50, 3000), 12000);
    
    updateLog(index, { 
      status: isAudio ? 'recording' : 'typing',
      type: messageMode
    });

    // Enviar Presence (Digitando ou Gravando)
    await fetch('/api/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: 'presence', 
        number: contact.number, 
        instance: instanceName, 
        delay: typingDelay,
        mediaType: isAudio ? 'audio' : 'text'
      })
    });

    await delay(typingDelay);
    if (campaignRef.current.status !== 'running') return false;

    try {
      let sendRes: Response;

      if (messageMode === 'text') {
        // Envio de Texto
        sendRes = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            action: 'sendText', 
            number: contact.number, 
            message: text, 
            instance: instanceName 
          })
        });
      } else if (messageMode === 'image') {
        // Envio de Imagem + Legenda
        sendRes = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            action: 'sendMedia', 
            number: contact.number, 
            mediaType: 'image',
            mediaBase64: imageInputMethod === 'upload' ? imageBase64 : undefined,
            mediaUrl: imageInputMethod === 'url' ? imageUrl : undefined,
            fileName: imageFileName || 'imagem.jpg',
            caption: text,
            instance: instanceName 
          })
        });
      } else {
        // Envio de Áudio (PTT ou Arquivo)
        sendRes = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            action: 'sendAudio', 
            number: contact.number, 
            mediaBase64: audioInputMethod === 'url' ? undefined : audioBase64,
            mediaUrl: audioInputMethod === 'url' ? audioUrl : undefined,
            fileName: audioFileName || 'audio.ogg',
            isPtt: isPtt,
            caption: text,
            instance: instanceName 
          })
        });
      }
      
      if (sendRes.ok) {
         updateLog(index, { status: 'sent', type: messageMode });
         return true;
      } else {
         const err = await sendRes.json();
         const detailMsg = err.details?.message || err.details?.response?.message || JSON.stringify(err.details) || err.error;
         updateLog(index, { status: 'failed', error: typeof detailMsg === 'string' ? detailMsg : 'Falha na API' });
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
       const waitSeconds = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
       await delay(waitSeconds * 1000);
    }
  };

  const startCampaign = async () => {
    if (contacts.length === 0) return;

    // Validações antes de iniciar
    if (messageMode === 'image' && !imageBase64 && !imageUrl) {
      alert('Por favor, carregue uma imagem ou informe a URL da imagem antes de iniciar o disparo.');
      return;
    }

    if (messageMode === 'audio' && !audioBase64 && !audioUrl) {
      alert('Por favor, grave um áudio ou selecione um arquivo de áudio antes de iniciar o disparo.');
      return;
    }
    
    // Atualiza o ref síncronamente para o loop enxergar imediatamente
    campaignRef.current = { ...campaignRef.current, status: 'running' };
    setCampaign(campaignRef.current);
    
    for (let i = campaignRef.current.currentContactIndex; i < contacts.length; i++) {
      if (campaignRef.current.status !== 'running') break;
      
      const contact = contacts[i];
      const hasWhatsApp = await checkWhatsAppNumber(contact.number, i);
      
      if (!hasWhatsApp) {
        campaignRef.current = { ...campaignRef.current, failed: campaignRef.current.failed + 1, currentContactIndex: i + 1 };
        setCampaign(campaignRef.current);
        continue;
      }
      
      if (campaignRef.current.status !== 'running') break;

      const finalText = parseSpintax(injectVariables(messageTemplate, contact));
      const success = await sendPresenceAndMessage(contact, finalText, i);

      campaignRef.current = { 
        ...campaignRef.current, 
        sent: campaignRef.current.sent + (success ? 1 : 0),
        failed: campaignRef.current.failed + (success ? 0 : 1),
        currentContactIndex: i + 1 
      };
      setCampaign(campaignRef.current);

      if (i === contacts.length - 1) {
        campaignRef.current = { ...campaignRef.current, status: 'completed' };
        setCampaign(campaignRef.current);
        break;
      }

      if (campaignRef.current.status === 'running') {
        await handleCampaignCadence(i);
      }
    }
  };

  const pauseCampaign = () => {
    campaignRef.current = { ...campaignRef.current, status: 'paused' };
    setCampaign(campaignRef.current);
  };
  
  const stopCampaign = () => {
    campaignRef.current = { ...campaignRef.current, status: 'idle', currentContactIndex: 0, sent: 0, failed: 0 };
    setCampaign(campaignRef.current);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 sm:p-8 font-sans selection:bg-emerald-500/30">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent flex items-center gap-3">
              <Send className="w-8 h-8 text-emerald-400" />
              NEXUS Messenger
            </h1>
            <p className="text-zinc-400 mt-2">Disparador de Alta Conversão & Anti-Ban com Suporte Multimídia</p>
          </div>
          <div className="flex items-center gap-4 bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800/50 backdrop-blur-xl self-start sm:self-auto">
             <div className="text-right">
               <p className="text-xs text-zinc-400">Instância Conectada</p>
               <p className="font-semibold text-emerald-400">{instanceName || 'Aguardando...'}</p>
             </div>
             <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.7)]"></div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column - Config & Composer */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Contacts Input */}
            <div className="bg-zinc-900/40 p-6 rounded-3xl border border-zinc-800/60 backdrop-blur-md shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-zinc-800 to-zinc-700 group-hover:from-emerald-500 group-hover:to-cyan-500 transition-all duration-500"></div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2 text-zinc-100">
                  <Users className="w-5 h-5 text-emerald-400" />
                  Destinatários (CSV ou Lista)
                </h2>
                {contacts.length > 0 && (
                  <span className="text-xs font-mono bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-500/20">
                    {contacts.length} contatos prontos
                  </span>
                )}
              </div>
              <textarea 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Cole contatos ou CSV:&#10;551199999999,João&#10;551188888888,Maria"
                className="w-full h-32 bg-black/50 border border-zinc-700/50 rounded-xl p-4 text-sm text-zinc-300 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all resize-none placeholder:text-zinc-600 font-mono"
                disabled={campaign.status === 'running' || campaign.status === 'paused'}
              />
              <button 
                onClick={processInput}
                disabled={campaign.status === 'running' || !inputText.trim()}
                className="mt-3 w-full bg-zinc-800 hover:bg-zinc-700 text-white py-2.5 rounded-xl font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-sm shadow-md"
              >
                <Upload className="w-4 h-4" />
                Processar e Carregar Lista
              </button>
            </div>

            {/* Multimodal Message Composer */}
            <div className="bg-zinc-900/40 p-6 rounded-3xl border border-zinc-800/60 backdrop-blur-md shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-zinc-800 to-zinc-700 group-hover:from-emerald-500 group-hover:to-cyan-500 transition-all duration-500"></div>
              
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-cyan-400" />
                  Compositor Multimídia
                </h2>
              </div>

              {/* Message Mode Tabs */}
              <div className="grid grid-cols-3 gap-2 p-1 bg-black/60 rounded-2xl border border-zinc-800 mb-5">
                <button
                  type="button"
                  onClick={() => setMessageMode('text')}
                  disabled={campaign.status === 'running'}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-medium text-xs sm:text-sm transition-all ${
                    messageMode === 'text'
                      ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20 font-bold'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                  }`}
                >
                  <MessageSquare className="w-4 h-4" />
                  Texto
                </button>

                <button
                  type="button"
                  onClick={() => setMessageMode('image')}
                  disabled={campaign.status === 'running'}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-medium text-xs sm:text-sm transition-all ${
                    messageMode === 'image'
                      ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20 font-bold'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                  }`}
                >
                  <ImageIcon className="w-4 h-4" />
                  Imagem
                </button>

                <button
                  type="button"
                  onClick={() => setMessageMode('audio')}
                  disabled={campaign.status === 'running'}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-medium text-xs sm:text-sm transition-all ${
                    messageMode === 'audio'
                      ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20 font-bold'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                  }`}
                >
                  <Mic className="w-4 h-4" />
                  Áudio
                </button>
              </div>

              {/* IMAGE ATTACHMENT SECTION */}
              {messageMode === 'image' && (
                <div className="mb-5 p-4 rounded-2xl bg-black/40 border border-zinc-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4" /> Anexo de Imagem
                    </span>
                    <div className="flex gap-1 text-xs">
                      <button
                        type="button"
                        onClick={() => setImageInputMethod('upload')}
                        className={`px-2.5 py-1 rounded-lg transition-all ${imageInputMethod === 'upload' ? 'bg-cyan-500/20 text-cyan-300 font-medium' : 'text-zinc-500 hover:text-zinc-300'}`}
                      >
                        Upload Arquivo
                      </button>
                      <button
                        type="button"
                        onClick={() => setImageInputMethod('url')}
                        className={`px-2.5 py-1 rounded-lg transition-all ${imageInputMethod === 'url' ? 'bg-cyan-500/20 text-cyan-300 font-medium' : 'text-zinc-500 hover:text-zinc-300'}`}
                      >
                        Link URL
                      </button>
                    </div>
                  </div>

                  {imageInputMethod === 'upload' ? (
                    <div>
                      {!imageBase64 ? (
                        <label className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-700 hover:border-cyan-500/60 rounded-xl p-6 cursor-pointer transition-all bg-zinc-900/30 hover:bg-zinc-900/60 group">
                          <ImageIcon className="w-8 h-8 text-zinc-500 group-hover:text-cyan-400 transition-colors mb-2" />
                          <span className="text-xs font-medium text-zinc-300 group-hover:text-white">Clique para selecionar imagem</span>
                          <span className="text-[11px] text-zinc-500 mt-1">PNG, JPG, WebP ou GIF (máx 16MB)</span>
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={handleImageFileChange} 
                            className="hidden" 
                            disabled={campaign.status === 'running'}
                          />
                        </label>
                      ) : (
                        <div className="relative rounded-xl overflow-hidden border border-cyan-500/30 bg-black/60 p-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={imageBase64} alt="Preview" className="max-h-48 w-full object-contain rounded-lg" />
                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-800 text-xs text-zinc-400 px-1">
                            <span className="truncate max-w-[200px]">{imageFileName || 'Imagem carregada'}</span>
                            <button 
                              type="button" 
                              onClick={() => { setImageBase64(''); setImageFileName(''); }} 
                              className="text-red-400 hover:text-red-300 flex items-center gap-1"
                              disabled={campaign.status === 'running'}
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Remover
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <LinkIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                          <input 
                            type="url" 
                            placeholder="https://exemplo.com/foto.jpg"
                            value={imageUrl}
                            onChange={(e) => setImageUrl(e.target.value)}
                            className="w-full bg-black/60 border border-zinc-700/60 rounded-xl pl-9 pr-3 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-cyan-500"
                            disabled={campaign.status === 'running'}
                          />
                        </div>
                      </div>
                      {imageUrl && (
                        <div className="relative rounded-xl overflow-hidden border border-zinc-800 bg-black/60 p-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img 
                            src={imageUrl} 
                            alt="URL Preview" 
                            className="max-h-40 w-full object-contain rounded-lg"
                            onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* AUDIO ATTACHMENT SECTION */}
              {messageMode === 'audio' && (
                <div className="mb-5 p-4 rounded-2xl bg-black/40 border border-zinc-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                      <Volume2 className="w-4 h-4" /> Mensagem de Voz / Áudio
                    </span>
                    <div className="flex gap-1 text-xs">
                      <button
                        type="button"
                        onClick={() => setAudioInputMethod('record')}
                        className={`px-2.5 py-1 rounded-lg transition-all ${audioInputMethod === 'record' ? 'bg-purple-500/20 text-purple-300 font-medium' : 'text-zinc-500 hover:text-zinc-300'}`}
                      >
                        Gravar Voz
                      </button>
                      <button
                        type="button"
                        onClick={() => setAudioInputMethod('upload')}
                        className={`px-2.5 py-1 rounded-lg transition-all ${audioInputMethod === 'upload' ? 'bg-purple-500/20 text-purple-300 font-medium' : 'text-zinc-500 hover:text-zinc-300'}`}
                      >
                        Upload Arquivo
                      </button>
                      <button
                        type="button"
                        onClick={() => setAudioInputMethod('url')}
                        className={`px-2.5 py-1 rounded-lg transition-all ${audioInputMethod === 'url' ? 'bg-purple-500/20 text-purple-300 font-medium' : 'text-zinc-500 hover:text-zinc-300'}`}
                      >
                        Link URL
                      </button>
                    </div>
                  </div>

                  {/* Record Audio */}
                  {audioInputMethod === 'record' && (
                    <div className="flex flex-col items-center justify-center p-4 bg-zinc-950/60 rounded-xl border border-zinc-800 space-y-3">
                      {!isRecording ? (
                        <div className="flex flex-col items-center">
                          <button
                            type="button"
                            onClick={startRecording}
                            disabled={campaign.status === 'running'}
                            className="w-16 h-16 rounded-full bg-gradient-to-tr from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 flex items-center justify-center shadow-lg shadow-purple-600/30 transition-transform active:scale-95 disabled:opacity-50 cursor-pointer"
                          >
                            <Mic className="w-7 h-7 text-white" />
                          </button>
                          <span className="text-xs text-zinc-400 mt-2 font-medium">Toque para gravar sua voz</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-red-500 animate-ping"></span>
                            <span className="font-mono text-lg font-bold text-red-400">{formatTimer(recordingTime)}</span>
                          </div>
                          <button
                            type="button"
                            onClick={stopRecording}
                            className="px-5 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
                          >
                            <MicOff className="w-4 h-4" /> Parar e Salvar Gravação
                          </button>
                        </div>
                      )}

                      {/* Player for recorded audio */}
                      {audioBase64 && !isRecording && (
                        <div className="w-full pt-3 border-t border-zinc-800 space-y-2">
                          <div className="flex items-center justify-between text-xs text-zinc-400">
                            <span className="flex items-center gap-1 text-emerald-400 font-medium">
                              <Check className="w-3.5 h-3.5" /> Áudio gravado pronto
                            </span>
                            <button
                              type="button"
                              onClick={() => { setAudioBase64(''); setAudioFileName(''); }}
                              className="text-red-400 hover:text-red-300 flex items-center gap-1 text-xs cursor-pointer"
                              disabled={campaign.status === 'running'}
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Excluir
                            </button>
                          </div>
                          <audio controls src={audioBase64} className="w-full h-10 accent-purple-500" />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Upload Audio File */}
                  {audioInputMethod === 'upload' && (
                    <div>
                      {!audioBase64 ? (
                        <label className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-700 hover:border-purple-500/60 rounded-xl p-6 cursor-pointer transition-all bg-zinc-900/30 hover:bg-zinc-900/60 group">
                          <FileAudio className="w-8 h-8 text-zinc-500 group-hover:text-purple-400 transition-colors mb-2" />
                          <span className="text-xs font-medium text-zinc-300 group-hover:text-white">Selecionar arquivo de áudio</span>
                          <span className="text-[11px] text-zinc-500 mt-1">MP3, OGG, WAV, M4A ou OPUS</span>
                          <input 
                            type="file" 
                            accept="audio/*" 
                            onChange={handleAudioFileChange} 
                            className="hidden" 
                            disabled={campaign.status === 'running'}
                          />
                        </label>
                      ) : (
                        <div className="p-3 bg-zinc-950/60 rounded-xl border border-zinc-800 space-y-2">
                          <div className="flex items-center justify-between text-xs text-zinc-300">
                            <span className="truncate max-w-[200px]">{audioFileName || 'Arquivo de áudio'}</span>
                            <button 
                              type="button" 
                              onClick={() => { setAudioBase64(''); setAudioFileName(''); }} 
                              className="text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer"
                              disabled={campaign.status === 'running'}
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Remover
                            </button>
                          </div>
                          <audio controls src={audioBase64} className="w-full h-10 accent-purple-500" />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Audio URL */}
                  {audioInputMethod === 'url' && (
                    <div className="space-y-2">
                      <div className="relative">
                        <LinkIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                        <input 
                          type="url" 
                          placeholder="https://exemplo.com/audio.mp3"
                          value={audioUrl}
                          onChange={(e) => setAudioUrl(e.target.value)}
                          className="w-full bg-black/60 border border-zinc-700/60 rounded-xl pl-9 pr-3 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-purple-500"
                          disabled={campaign.status === 'running'}
                        />
                      </div>
                      {audioUrl && (
                        <audio controls src={audioUrl} className="w-full h-10 accent-purple-500" />
                      )}
                    </div>
                  )}

                  {/* PTT Checkbox */}
                  <label className="flex items-center gap-2 cursor-pointer pt-1">
                    <input 
                      type="checkbox" 
                      checked={isPtt} 
                      onChange={(e) => setIsPtt(e.target.checked)}
                      className="accent-purple-500 w-4 h-4 rounded" 
                      disabled={campaign.status === 'running'}
                    />
                    <span className="text-xs text-zinc-300">
                      Enviar como <strong className="text-purple-300">Nota de Voz Gravada (PTT)</strong> com ondas sonoras no WhatsApp
                    </span>
                  </label>
                </div>
              )}

              {/* Message / Caption Text Box */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-zinc-400">
                    {messageMode === 'image' ? 'Legenda da Imagem (Opcional)' : messageMode === 'audio' ? 'Texto de Acompanhamento (Opcional)' : 'Mensagem de Texto'}
                  </label>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => insertVariable('{nome}')}
                      className="text-[11px] bg-zinc-800 hover:bg-zinc-700 text-emerald-400 px-2 py-0.5 rounded font-mono transition-colors"
                      title="Insere {nome} dinâmico do contato"
                    >
                      +&#123;nome&#125;
                    </button>
                    <button
                      type="button"
                      onClick={() => insertVariable('{Olá|Oi|Opa}')}
                      className="text-[11px] bg-zinc-800 hover:bg-zinc-700 text-cyan-400 px-2 py-0.5 rounded font-mono transition-colors"
                      title="Insere variação Spintax"
                    >
                      +Spintax
                    </button>
                  </div>
                </div>

                <textarea 
                  value={messageTemplate}
                  onChange={(e) => setMessageTemplate(e.target.value)}
                  placeholder={messageMode === 'image' ? 'Escreva a legenda com Spintax ou {nome}...' : 'Escreva sua mensagem...'}
                  className="w-full h-32 bg-black/50 border border-zinc-700/50 rounded-xl p-4 text-sm text-zinc-300 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all resize-none"
                  disabled={campaign.status === 'running' || campaign.status === 'paused'}
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-zinc-500">
                <span className="bg-black/40 px-2 py-1 rounded border border-zinc-800">Spintax: &#123;Oi|Olá|Opa&#125;</span>
                <span className="bg-black/40 px-2 py-1 rounded border border-zinc-800">Variáveis: &#123;nome&#125;, &#123;numero&#125;</span>
              </div>
            </div>

            {/* Anti-ban Settings */}
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

          {/* Right Column - Status, Progress & Logs */}
          <div className="lg:col-span-7 flex flex-col space-y-6">
            
            {/* Main Control Panel */}
            <div className="bg-gradient-to-br from-zinc-900 to-black p-8 rounded-3xl border border-zinc-800 shadow-2xl relative overflow-hidden">
               {/* Progress Bar */}
               <div className="absolute bottom-0 left-0 h-1.5 bg-zinc-800 w-full">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-1000 ease-out shadow-[0_0_20px_rgba(16,185,129,0.8)]" 
                    style={{ width: `${campaign.total ? (campaign.currentContactIndex / campaign.total) * 100 : 0}%` }}
                  ></div>
               </div>

               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                 <div>
                   <h2 className="text-2xl font-bold mb-1 text-white">Progresso da Campanha</h2>
                   <div className="text-zinc-400 flex items-center gap-2 mt-2">
                     <span className="text-xs">Status:</span>
                     {campaign.status === 'idle' && <span className="text-zinc-400 bg-zinc-800 px-3 py-1 rounded-full text-xs font-medium">Aguardando Início</span>}
                     {campaign.status === 'running' && <span className="text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full text-xs font-semibold animate-pulse flex items-center gap-1.5"><span className="w-2 h-2 bg-emerald-400 rounded-full"></span>Disparando</span>}
                     {campaign.status === 'paused' && <span className="text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full text-xs font-semibold">Disparo Pausado</span>}
                     {campaign.status === 'completed' && <span className="text-blue-400 bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full text-xs font-semibold">Campanha Concluída</span>}
                   </div>
                 </div>
                 
                 <div className="flex gap-3">
                   <div className="text-center px-5 py-3 bg-black/40 rounded-2xl border border-zinc-800/60 min-w-[75px]">
                     <p className="text-3xl font-light text-white">{campaign.total}</p>
                     <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-1">Total</p>
                   </div>
                   <div className="text-center px-5 py-3 bg-emerald-500/5 rounded-2xl border border-emerald-500/20 min-w-[75px]">
                     <p className="text-3xl font-light text-emerald-400">{campaign.sent}</p>
                     <p className="text-[10px] text-emerald-500/70 font-bold uppercase tracking-wider mt-1">Enviados</p>
                   </div>
                   <div className="text-center px-5 py-3 bg-red-500/5 rounded-2xl border border-red-500/20 min-w-[75px]">
                     <p className="text-3xl font-light text-red-400">{campaign.failed}</p>
                     <p className="text-[10px] text-red-500/70 font-bold uppercase tracking-wider mt-1">Falhas</p>
                   </div>
                 </div>
               </div>

               {/* Active Mode Banner */}
               <div className="mt-6 p-3 bg-black/40 rounded-xl border border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
                 <span className="flex items-center gap-2">
                   Modo Atual:
                   {messageMode === 'text' && <strong className="text-emerald-400 flex items-center gap-1"><MessageSquare className="w-3.5 h-3.5"/> Texto Puro</strong>}
                   {messageMode === 'image' && <strong className="text-cyan-400 flex items-center gap-1"><ImageIcon className="w-3.5 h-3.5"/> Imagem + Legenda</strong>}
                   {messageMode === 'audio' && <strong className="text-purple-400 flex items-center gap-1"><Mic className="w-3.5 h-3.5"/> Áudio {isPtt ? '(Nota de Voz PTT)' : '(Arquivo)'}</strong>}
                 </span>
                 <span className="text-zinc-500 font-mono">
                   {campaign.total > 0 ? `${Math.round((campaign.currentContactIndex / campaign.total) * 100)}% concluído` : '0%'}
                 </span>
               </div>

               <div className="flex gap-4 mt-6">
                 {campaign.status === 'idle' || campaign.status === 'paused' ? (
                   <button 
                     onClick={startCampaign}
                     disabled={contacts.length === 0}
                     className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black py-4 rounded-2xl font-bold transition-all shadow-[0_0_25px_rgba(16,185,129,0.3)] hover:shadow-[0_0_35px_rgba(16,185,129,0.5)] flex items-center justify-center gap-2 disabled:opacity-50 disabled:shadow-none cursor-pointer"
                   >
                     <Play className="w-5 h-5" fill="currentColor"/> {campaign.status === 'paused' ? 'Retomar Disparo' : 'Iniciar Campanha Multimídia'}
                   </button>
                 ) : (
                   <button 
                     onClick={pauseCampaign}
                     className="flex-1 bg-amber-500 hover:bg-amber-400 text-black py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(245,158,11,0.3)]"
                   >
                     <Pause className="w-5 h-5" fill="currentColor"/> Pausar Disparo
                   </button>
                 )}
                 <button 
                   onClick={stopCampaign}
                   disabled={campaign.status === 'idle'}
                   className="px-8 bg-zinc-800 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 text-white py-4 rounded-2xl font-bold transition-all border border-zinc-700 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                 >
                   <Square className="w-5 h-5" fill="currentColor"/> Parar
                 </button>
               </div>
            </div>

            {/* Live Operations Table */}
            <div className="flex-1 bg-zinc-900/40 rounded-3xl border border-zinc-800/60 backdrop-blur-md shadow-2xl flex flex-col overflow-hidden min-h-[420px]">
               <div className="p-4 border-b border-zinc-800/50 bg-black/30 flex justify-between items-center">
                 <h3 className="font-semibold text-zinc-200 flex items-center gap-2 text-sm">
                   Registro de Execução em Tempo Real
                   {campaign.status === 'running' && (
                     <span className="flex gap-1 items-center ml-2">
                       <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce"></span>
                       <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></span>
                       <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></span>
                     </span>
                   )}
                 </h3>
                 <span className="text-xs text-zinc-500 font-mono">
                   {logs.filter(l => l.status === 'sent').length} / {logs.length} processados
                 </span>
               </div>
               
               <div className="flex-1 overflow-auto p-2 max-h-[480px]">
                 {logs.length === 0 ? (
                   <div className="h-64 flex flex-col items-center justify-center text-zinc-600 space-y-3">
                     <AlertTriangle className="w-10 h-10 opacity-30" />
                     <p className="text-sm">Carregue uma lista de contatos para ver o log.</p>
                   </div>
                 ) : (
                   <table className="w-full text-left text-sm text-zinc-400">
                     <thead className="text-xs uppercase bg-black/50 text-zinc-500 sticky top-0 backdrop-blur-sm">
                       <tr>
                         <th className="px-4 py-3 rounded-l-lg">Destinatário</th>
                         <th className="px-4 py-3">Tipo</th>
                         <th className="px-4 py-3">Status</th>
                         <th className="px-4 py-3 text-right">Hora</th>
                         <th className="px-4 py-3 rounded-r-lg">Detalhe</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-zinc-800/40">
                       {logs.map((log, idx) => (
                         <tr 
                           key={`${log.number}-${idx}`} 
                           className={`hover:bg-zinc-800/30 transition-colors ${idx === campaign.currentContactIndex && campaign.status === 'running' ? 'bg-emerald-500/10' : ''}`}
                         >
                           <td className="px-4 py-3 font-mono text-zinc-200">
                             {log.number}
                             {log.name && <span className="ml-2 text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">{log.name}</span>}
                           </td>
                           <td className="px-4 py-3">
                             {log.type === 'text' && (
                               <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-medium">
                                 <MessageSquare className="w-3 h-3" /> Texto
                               </span>
                             )}
                             {log.type === 'image' && (
                               <span className="inline-flex items-center gap-1 text-[11px] bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded font-medium">
                                 <ImageIcon className="w-3 h-3" /> Imagem
                               </span>
                             )}
                             {log.type === 'audio' && (
                               <span className="inline-flex items-center gap-1 text-[11px] bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded font-medium">
                                 <Mic className="w-3 h-3" /> Áudio
                               </span>
                             )}
                           </td>
                           <td className="px-4 py-3">
                             {log.status === 'pending' && <span className="text-zinc-600 text-xs">Pendente</span>}
                             {log.status === 'checking' && <span className="text-cyan-400 animate-pulse text-xs">Validando...</span>}
                             {log.status === 'typing' && <span className="text-emerald-400 animate-pulse text-xs">Digitando...</span>}
                             {log.status === 'recording' && <span className="text-purple-400 animate-pulse text-xs">Gravando áudio...</span>}
                             {log.status === 'sent' && <span className="text-emerald-400 flex items-center gap-1 text-xs font-medium"><CheckCircle2 className="w-4 h-4"/> Enviado</span>}
                             {log.status === 'failed' && <span className="text-red-400 flex items-center gap-1 text-xs"><XCircle className="w-4 h-4"/> Falha</span>}
                           </td>
                           <td className="px-4 py-3 text-right font-mono text-xs text-zinc-500">{log.time || '-'}</td>
                           <td className="px-4 py-3 text-xs text-zinc-400 truncate max-w-[140px]">{log.error || 'ok'}</td>
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
