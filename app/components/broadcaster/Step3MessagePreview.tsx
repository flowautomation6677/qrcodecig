'use client';

import React, { useState, useRef, useMemo } from 'react';
import { 
  MessageSquare, Image as ImageIcon, Video, Mic, Volume2, 
  Trash2, Upload, Link as LinkIcon, Sparkles, Check, 
  ArrowRight, ArrowLeft, Eye, RefreshCw, Smartphone, CheckCheck,
  Dices, Sun, Moon, Sunrise
} from 'lucide-react';
import { BroadcasterFormData, MessageMode } from './types';
import { renderTemplate } from '@/src/lib/template';

interface Props {
  formData: BroadcasterFormData;
  updateFormData: (updates: Partial<BroadcasterFormData>) => void;
  onNext: () => void;
  onBack: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning') => void;
}

export default function Step3MessagePreview({ formData, updateFormData, onNext, onBack, showToast }: Props) {
  // Preview selector (contato 0, 1 ou 2)
  const [selectedPreviewIndex, setSelectedPreviewIndex] = useState(0);

  // Simulação de horário para preview da saudação
  const [simulatedHour, setSimulatedHour] = useState<number | null>(null);

  // Semente de Spintax para re-rolar variações
  const [spintaxRoll, setSpintaxRoll] = useState(0);

  // Gravação de Áudio
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Amostra dos primeiros 3 contatos válidos para preview real
  const top3Contacts = useMemo(() => {
    return formData.sanitizedContacts.slice(0, 3);
  }, [formData.sanitizedContacts]);

  // Data simulada para o cálculo de saudação
  const simulatedDate = useMemo(() => {
    const d = new Date();
    if (simulatedHour !== null) {
      d.setHours(simulatedHour, 30, 0, 0);
    }
    return d;
  }, [simulatedHour]);

  // Renderização da mensagem em tempo real para o contato selecionado
  const renderedMessage = useMemo(() => {
    const contact = top3Contacts[selectedPreviewIndex];

    const ctx = {
      name: contact ? contact.name : undefined,
      phone: contact ? contact.normalizedPhone : undefined,
      variables: contact ? contact.variables : undefined,
      now: simulatedDate,
      timezone: formData.timezone || 'America/Sao_Paulo',
      keepTitles: formData.keepTitles,
    };

    return renderTemplate(formData.messageTemplate, ctx);
  }, [formData.messageTemplate, top3Contacts, selectedPreviewIndex, simulatedDate, formData.timezone, formData.keepTitles, spintaxRoll]);

  // Inserir tag de variável no cursor
  const insertTag = (tag: string) => {
    updateFormData({
      messageTemplate: formData.messageTemplate + tag,
    });
  };

  // Upload de Imagem
  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Selecione um arquivo de imagem válido (JPG, PNG, WebP).', 'warning');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      updateFormData({
        mediaBase64: ev.target?.result as string,
        mediaFileName: file.name,
      });
    };
    reader.readAsDataURL(file);
  };

  // Upload de Vídeo
  const handleVideoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      showToast('Selecione um arquivo de vídeo válido (MP4, WebM).', 'warning');
      return;
    }
    if (file.size > 16 * 1024 * 1024) {
      showToast('O vídeo deve ter no máximo 16MB.', 'warning');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      updateFormData({
        mediaBase64: ev.target?.result as string,
        mediaFileName: file.name,
      });
    };
    reader.readAsDataURL(file);
  };

  // Upload de Áudio
  const handleAudioFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      updateFormData({
        mediaBase64: ev.target?.result as string,
        mediaFileName: file.name,
      });
    };
    reader.readAsDataURL(file);
  };

  // Gravação de microfone
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/ogg; codecs=opus' });
        const reader = new FileReader();
        reader.onloadend = () => {
          updateFormData({
            mediaBase64: reader.result as string,
            mediaFileName: `audio_${Date.now()}.ogg`,
            isPtt: true,
          });
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      showToast('Não foi possível acessar o microfone: ' + (err.message || 'Permissão negada'), 'error');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }
  };

  const handleProceed = () => {
    if (!formData.messageTemplate.trim() && formData.messageMode === 'text') {
      showToast('Digite o texto da mensagem antes de continuar.', 'warning');
      return;
    }

    if (formData.messageMode === 'image' && !formData.mediaBase64 && !formData.mediaUrl) {
      showToast('Selecione uma imagem ou informe a URL da imagem.', 'warning');
      return;
    }

    if (formData.messageMode === 'video' && !formData.mediaBase64 && !formData.mediaUrl) {
      showToast('Selecione um arquivo de vídeo ou informe a URL do vídeo.', 'warning');
      return;
    }

    if (formData.messageMode === 'audio' && !formData.mediaBase64 && !formData.mediaUrl) {
      showToast('Grave ou selecione um áudio antes de continuar.', 'warning');
      return;
    }

    onNext();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Coluna da Esquerda: Compositor e Mídia */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Seletor de Formato */}
          <div className="bg-zinc-900/40 p-5 rounded-3xl border border-zinc-800/60">
            <span className="text-xs font-semibold text-zinc-400 block mb-3 uppercase tracking-wider">
              Formato da Mensagem
            </span>
            <div className="grid grid-cols-4 gap-2 p-1 bg-black/60 rounded-2xl border border-zinc-800">
              <button
                type="button"
                onClick={() => updateFormData({ messageMode: 'text' })}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-medium text-xs sm:text-sm transition-all cursor-pointer ${
                  formData.messageMode === 'text'
                    ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20 font-bold'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                Texto
              </button>

              <button
                type="button"
                onClick={() => updateFormData({ messageMode: 'image' })}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-medium text-xs sm:text-sm transition-all cursor-pointer ${
                  formData.messageMode === 'image'
                    ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20 font-bold'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                }`}
              >
                <ImageIcon className="w-4 h-4" />
                Imagem
              </button>

              <button
                type="button"
                onClick={() => updateFormData({ messageMode: 'audio' })}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-medium text-xs sm:text-sm transition-all cursor-pointer ${
                  formData.messageMode === 'audio'
                    ? 'bg-purple-500 text-black shadow-lg shadow-purple-500/20 font-bold'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                }`}
              >
                <Volume2 className="w-4 h-4" />
                Áudio
              </button>

              <button
                type="button"
                onClick={() => updateFormData({ messageMode: 'video' })}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-medium text-xs sm:text-sm transition-all cursor-pointer ${
                  formData.messageMode === 'video'
                    ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20 font-bold'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                }`}
              >
                <Video className="w-4 h-4" />
                Vídeo
              </button>
            </div>
          </div>

          {/* Upload / Config de Mídia (se não for texto puro) */}
          {formData.messageMode !== 'text' && (
            <div className="bg-zinc-900/40 p-5 rounded-3xl border border-zinc-800/60 space-y-4">
              <span className="text-xs font-semibold text-zinc-300 block">
                Anexo de {formData.messageMode === 'image' ? 'Imagem' : formData.messageMode === 'audio' ? 'Áudio' : 'Vídeo'}
              </span>

              {formData.messageMode === 'image' && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageFile}
                      className="text-xs text-zinc-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-zinc-800 file:text-emerald-400 hover:file:bg-zinc-700 cursor-pointer"
                    />
                  </div>
                  <input
                    type="text"
                    value={formData.mediaUrl}
                    onChange={(e) => updateFormData({ mediaUrl: e.target.value })}
                    placeholder="Ou cole a URL direta da imagem (https://...)"
                    className="w-full bg-black/50 border border-zinc-700/60 rounded-xl p-2.5 text-xs text-zinc-200"
                  />
                  {(formData.mediaBase64 || formData.mediaUrl) && (
                    <div className="relative inline-block mt-2">
                      <img
                        src={formData.mediaBase64 || formData.mediaUrl}
                        alt="Preview"
                        className="h-28 rounded-xl object-cover border border-zinc-700"
                      />
                      <button
                        type="button"
                        onClick={() => updateFormData({ mediaBase64: '', mediaUrl: '', mediaFileName: '' })}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {formData.messageMode === 'video' && (
                <div className="space-y-3">
                  <input
                    type="file"
                    accept="video/*"
                    onChange={handleVideoFile}
                    className="text-xs text-zinc-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-zinc-800 file:text-amber-400 hover:file:bg-zinc-700 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={formData.mediaUrl}
                    onChange={(e) => updateFormData({ mediaUrl: e.target.value })}
                    placeholder="Ou cole a URL direta do vídeo (MP4)"
                    className="w-full bg-black/50 border border-zinc-700/60 rounded-xl p-2.5 text-xs text-zinc-200"
                  />
                </div>
              )}

              {formData.messageMode === 'audio' && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    {!isRecording ? (
                      <button
                        type="button"
                        onClick={startRecording}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600/30 text-purple-300 border border-purple-500/40 text-xs font-semibold hover:bg-purple-600/50 cursor-pointer"
                      >
                        <Mic className="w-3.5 h-3.5" /> Gravar Microfone
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={stopRecording}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold animate-pulse cursor-pointer"
                      >
                        Parar Gravação ({recordingTime}s)
                      </button>
                    )}

                    <input
                      type="file"
                      accept="audio/*"
                      onChange={handleAudioFile}
                      className="text-xs text-zinc-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-zinc-800 file:text-purple-400 hover:file:bg-zinc-700 cursor-pointer"
                    />
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300 pt-1">
                    <input
                      type="checkbox"
                      checked={formData.isPtt}
                      onChange={(e) => updateFormData({ isPtt: e.target.checked })}
                      className="rounded border-zinc-700 text-purple-500 focus:ring-0"
                    />
                    <span>Enviar como <strong>Nota de Voz Gravada na Hora (PTT)</strong></span>
                  </label>
                </div>
              )}
            </div>
          )}

          {/* Editor de Texto do Template */}
          <div className="bg-zinc-900/40 p-6 rounded-3xl border border-zinc-800/60 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                Texto da Mensagem {formData.messageMode !== 'text' && '(Legenda)'}
              </span>
              <span className="text-[11px] text-zinc-500 font-mono">
                {formData.messageTemplate.length} caracteres
              </span>
            </div>

            {/* Pílulas de Variáveis & Helpers */}
            <div className="flex flex-wrap gap-1.5 p-2.5 bg-black/40 rounded-2xl border border-zinc-800/80">
              <span className="text-[10px] uppercase font-bold text-zinc-500 self-center px-1">Inserir:</span>
              <button
                type="button"
                onClick={() => insertTag('{{primeiro_nome}}')}
                className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-mono border border-emerald-500/20 transition-all cursor-pointer"
                title="Nome capitalizado (ex: Rosani)"
              >
                {'{{primeiro_nome}}'}
              </button>
              <button
                type="button"
                onClick={() => insertTag('{{saudacao}}')}
                className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-mono border border-emerald-500/20 transition-all cursor-pointer"
                title="Bom dia / Boa tarde / Boa noite dinâmico"
              >
                {'{{saudacao}}'}
              </button>
              <button
                type="button"
                onClick={() => insertTag('{{primeiro_nome|tudo bem}}')}
                className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-mono border border-amber-500/20 transition-all cursor-pointer"
                title="Com fallback: usa 'tudo bem' se o nome estiver vazio"
              >
                {'{{primeiro_nome|tudo bem}}'}
              </button>
              <button
                type="button"
                onClick={() => insertTag('{Olá|Oi|Tudo bem}')}
                className="px-2.5 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 text-xs font-mono border border-purple-500/20 transition-all cursor-pointer"
                title="Spintax anti-ban: varia o texto entre disparos"
              >
                {'{Spintax}'}
              </button>
              <button
                type="button"
                onClick={() => insertTag('{{nome_completo}}')}
                className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-mono border border-zinc-700 transition-all cursor-pointer"
              >
                {'{{nome_completo}}'}
              </button>
              {formData.extraColumns.map((col) => (
                <button
                  key={col}
                  type="button"
                  onClick={() => insertTag(`{{${col}}}`)}
                  className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-xs font-mono border border-cyan-500/20 transition-all cursor-pointer"
                >
                  {`{{${col}}}`}
                </button>
              ))}
            </div>

            <textarea
              rows={8}
              value={formData.messageTemplate}
              onChange={(e) => updateFormData({ messageTemplate: e.target.value })}
              placeholder="Ex: {{saudacao}}, {{primeiro_nome|tudo bem}}!&#10;&#10;{Aqui é|Fala com} o time da Flowrocket..."
              className="w-full bg-black/60 border border-zinc-700/60 rounded-2xl p-4 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500/50 leading-relaxed font-sans"
            />

            {/* Opções Avançadas de Formatação */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
                <input
                  type="checkbox"
                  checked={formData.keepTitles}
                  onChange={(e) => updateFormData({ keepTitles: e.target.checked })}
                  className="rounded border-zinc-700 text-emerald-500 focus:ring-0"
                />
                <span>Preservar títulos profissionais (<code className="text-emerald-400">Dr.</code>, <code className="text-emerald-400">Dra.</code>, <code className="text-emerald-400">Prof.</code>)</span>
              </label>

              <button
                type="button"
                onClick={() => setSpintaxRoll((r) => r + 1)}
                className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 cursor-pointer"
                title="Sorteia outra combinação de Spintax para o preview"
              >
                <Dices className="w-3.5 h-3.5" />
                Sortear Spintax
              </button>
            </div>
          </div>
        </div>

        {/* Coluna da Direita: Preview WhatsApp Real dos 3 Primeiros Contatos */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-emerald-400" />
              Preview Real dos 3 Primeiros Contatos
            </span>
          </div>

          {/* Abas dos 3 Contatos */}
          {top3Contacts.length > 0 && (
            <div className="flex gap-2">
              {top3Contacts.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedPreviewIndex(i)}
                  className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                    selectedPreviewIndex === i
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-md'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  <span className="block truncate">Contato #{i + 1}</span>
                  <span className="text-[10px] block opacity-70 truncate font-mono">
                    {c.name ? c.name.split(' ')[0] : c.normalizedPhone}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Simulador de Horário para Saudação */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs">
            <span className="text-zinc-400 font-medium">Testar Saudação:</span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setSimulatedHour(9)}
                className={`px-2 py-1 rounded-lg text-[11px] flex items-center gap-1 cursor-pointer transition-colors ${
                  simulatedHour === 9
                    ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Sunrise className="w-3 h-3 text-amber-400" /> Manhã
              </button>
              <button
                type="button"
                onClick={() => setSimulatedHour(14)}
                className={`px-2 py-1 rounded-lg text-[11px] flex items-center gap-1 cursor-pointer transition-colors ${
                  simulatedHour === 14
                    ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Sun className="w-3 h-3 text-amber-300" /> Tarde
              </button>
              <button
                type="button"
                onClick={() => setSimulatedHour(20)}
                className={`px-2 py-1 rounded-lg text-[11px] flex items-center gap-1 cursor-pointer transition-colors ${
                  simulatedHour === 20
                    ? 'bg-purple-500/20 text-purple-300 font-bold border border-purple-500/40'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Moon className="w-3 h-3 text-purple-400" /> Noite
              </button>
            </div>
          </div>

          {/* Mockup do WhatsApp */}
          <div className="bg-[#0b141a] rounded-3xl border border-zinc-800 overflow-hidden shadow-2xl flex flex-col flex-1 min-h-[460px]">
            {/* Top Bar do Chat WhatsApp */}
            <div className="bg-[#202c33] px-4 py-3 flex items-center gap-3 border-b border-zinc-800/80">
              <div className="w-9 h-9 rounded-full bg-emerald-600/40 border border-emerald-500/30 flex items-center justify-center text-xs font-bold text-emerald-300 uppercase">
                {top3Contacts[selectedPreviewIndex]?.name
                  ? top3Contacts[selectedPreviewIndex].name?.charAt(0)
                  : 'W'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-zinc-100 truncate">
                  {top3Contacts[selectedPreviewIndex]?.name || 'Destinatário'}
                </p>
                <p className="text-[10px] font-mono text-zinc-400 truncate">
                  +{top3Contacts[selectedPreviewIndex]?.normalizedPhone || '55...'}
                </p>
              </div>
            </div>

            {/* Chat Body com Balão */}
            <div className="p-4 flex-1 flex flex-col justify-end bg-[radial-gradient(#1f2c34_1px,transparent_1px)] [background-size:16px_16px]">
              <div className="max-w-[90%] self-end bg-[#005c4b] text-zinc-100 rounded-2xl rounded-tr-sm p-3.5 shadow-md space-y-2 relative">
                
                {/* Mídia Anexada no Balão */}
                {formData.messageMode === 'image' && (formData.mediaBase64 || formData.mediaUrl) && (
                  <div className="rounded-xl overflow-hidden mb-2">
                    <img
                      src={formData.mediaBase64 || formData.mediaUrl}
                      alt="Anexo"
                      className="w-full max-h-48 object-cover rounded-xl"
                    />
                  </div>
                )}

                {formData.messageMode === 'audio' && (
                  <div className="flex items-center gap-3 py-1 bg-[#025142] px-3 rounded-xl">
                    <div className="w-8 h-8 rounded-full bg-emerald-400 text-black flex items-center justify-center">
                      <Volume2 className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="h-1 bg-zinc-400/40 rounded-full w-full"></div>
                      <span className="text-[10px] text-zinc-300 mt-1 block">
                        {formData.isPtt ? 'Mensagem de voz gravada' : 'Áudio'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Texto Renderizado */}
                <p className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed select-text font-normal text-zinc-100">
                  {renderedMessage || (
                    <span className="text-zinc-400 italic">
                      Digite o texto da mensagem para ver o preview em tempo real...
                    </span>
                  )}
                </p>

                {/* Hora & Ticks */}
                <div className="flex items-center justify-end gap-1 text-[10px] text-zinc-300 pt-1">
                  <span>
                    {simulatedDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <CheckCheck className="w-3.5 h-3.5 text-cyan-300" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navegação */}
      <div className="flex items-center justify-between pt-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-sm transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>

        <button
          type="button"
          onClick={handleProceed}
          className="flex items-center gap-2 px-8 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
        >
          Avançar para Janelas & Cadência
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
