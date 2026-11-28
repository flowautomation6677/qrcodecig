'use client';

import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  MessageSquare, Image as ImageIcon, Video, Mic, Volume2, 
  Trash2, Upload, Link as LinkIcon, Sparkles, Check, 
  ArrowRight, ArrowLeft, Eye, RefreshCw, Smartphone, CheckCheck,
  Dices, Sun, Moon, Sunrise, Zap, ShieldCheck, CheckCircle2, Play
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
  const isMeta = formData.provider === 'meta_official';

  // Preview selector (contato 0, 1 ou 2)
  const [selectedPreviewIndex, setSelectedPreviewIndex] = useState(0);

  // Simulação de horário para preview da saudação (Evolution)
  const [simulatedHour, setSimulatedHour] = useState<number | null>(null);

  // Semente de Spintax para re-rolar variações
  const [spintaxRoll, setSpintaxRoll] = useState(0);

  // Templates Meta Cloud API
  const [metaTemplates, setMetaTemplates] = useState<any[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);

  // Gravação de Áudio
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Busca templates aprovados da Meta quando o cliente selecionado é Meta Oficial
  useEffect(() => {
    if (!isMeta || !formData.selectedClientId) return;

    setLoadingTemplates(true);
    setTemplatesError(null);

    fetch(`/api/clients/${formData.selectedClientId}/meta/templates`)
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && Array.isArray(data.templates) && data.templates.length > 0) {
          setMetaTemplates(data.templates);

          // Se já tem um template selecionado ou seleciona o primeiro (preferência template_kelly)
          const kellyTpl = data.templates.find((t: any) => t.name === 'template_kelly');
          const activeTpl = kellyTpl || data.templates[0];

          if (activeTpl) {
            const bodyComp = activeTpl.components?.find((c: any) => c.type === 'BODY');
            const headerComp = activeTpl.components?.find((c: any) => c.type === 'HEADER');

            updateFormData({
              metaTemplateName: activeTpl.name,
              metaTemplateLanguage: activeTpl.language || 'pt_BR',
              messageTemplate: bodyComp?.text || formData.messageTemplate,
              messageMode: headerComp?.format?.toLowerCase() === 'video' ? 'video' : 'text',
              metaHeaderType: headerComp?.format?.toLowerCase() || 'none',
              metaHeaderUrl: headerComp?.example?.header_handle?.[0] || formData.metaHeaderUrl,
            });
          }
        } else {
          setTemplatesError(data.error || 'Nenhum template aprovado encontrado nesta conta WABA.');
        }
      })
      .catch((err) => {
        setTemplatesError('Erro ao consultar templates da Meta: ' + err.message);
      })
      .finally(() => {
        setLoadingTemplates(false);
      });
  }, [isMeta, formData.selectedClientId]);

  // Amostra dos primeiros 3 contatos válidos para preview real
  const top3Contacts = useMemo(() => {
    return (formData.sanitizedContacts || []).slice(0, 3);
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

  const handleSelectMetaTemplate = (templateName: string) => {
    const tpl = metaTemplates.find((t) => t.name === templateName);
    if (!tpl) return;

    const bodyComp = tpl.components?.find((c: any) => c.type === 'BODY');
    const headerComp = tpl.components?.find((c: any) => c.type === 'HEADER');
    const exampleMediaUrl = headerComp?.example?.header_handle?.[0] || '';

    updateFormData({
      metaTemplateName: tpl.name,
      metaTemplateLanguage: tpl.language || 'pt_BR',
      messageTemplate: bodyComp?.text || formData.messageTemplate,
      messageMode: headerComp?.format?.toLowerCase() === 'video' ? 'video' : headerComp?.format?.toLowerCase() === 'image' ? 'image' : 'text',
      metaHeaderType: headerComp?.format?.toLowerCase() || 'none',
      metaHeaderUrl: formData.metaHeaderUrl || exampleMediaUrl,
      mediaUrl: formData.mediaUrl || exampleMediaUrl,
    });
  };

  const handleProceed = () => {
    if (isMeta) {
      if (!formData.metaTemplateName) {
        showToast('Selecione um template oficial da Meta para continuar.', 'warning');
        return;
      }
      onNext();
      return;
    }

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
    <div className="space-y-6 animate-in fade-in duration-300 font-sans">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Coluna da Esquerda: Compositor / Seleção de Template */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* MODO 1: PROVEDOR API OFICIAL DA META */}
          {isMeta ? (
            <div className="space-y-6">
              {/* Card de Destaque da API Oficial */}
              <div className="bg-gradient-to-r from-cyan-950/40 via-zinc-900 to-zinc-900 p-5 rounded-3xl border border-cyan-500/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 flex items-center justify-center font-bold">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        WhatsApp Cloud API (Meta Oficial)
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                          Zero Ban
                        </span>
                      </h3>
                      <p className="text-xs text-zinc-400">
                        Disparo direto pelos servidores da Meta com templates corporativos aprovados.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Seletor de Template da WABA */}
              <div className="bg-zinc-900/40 p-6 rounded-3xl border border-zinc-800/60 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-cyan-400" />
                    Templates Aprovados na WABA
                  </span>

                  {loadingTemplates && (
                    <span className="text-xs text-cyan-400 flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Carregando templates...
                    </span>
                  )}
                </div>

                {templatesError && (
                  <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-xl text-xs text-red-300">
                    {templatesError}
                  </div>
                )}

                {metaTemplates.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3">
                    {metaTemplates.map((tpl) => {
                      const isSelected = formData.metaTemplateName === tpl.name;
                      const headerComp = tpl.components?.find((c: any) => c.type === 'HEADER');

                      return (
                        <button
                          key={tpl.id || tpl.name}
                          type="button"
                          onClick={() => handleSelectMetaTemplate(tpl.name)}
                          className={`text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-cyan-950/30 border-cyan-500/60 shadow-lg shadow-cyan-950/30'
                              : 'bg-black/40 border-zinc-800/80 hover:border-zinc-700'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-sm text-white">
                                {tpl.name}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                {tpl.status}
                              </span>
                            </div>

                            <span className="text-[11px] font-mono text-zinc-400">
                              {tpl.language || 'pt_BR'}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-xs text-zinc-400">
                            <span>Categoria: <strong>{tpl.category}</strong></span>
                            <span>•</span>
                            <span>
                              Cabeçalho:{' '}
                              <strong>{headerComp?.format || 'Nenhum'}</strong>
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-black/40 border border-zinc-800 text-xs text-zinc-400">
                    Template padrão ativo: <strong className="text-white">template_kelly</strong> (pt_BR • Vídeo + Texto).
                  </div>
                )}

                {/* Configuração do Vídeo / Link do Cabeçalho */}
                <div className="pt-4 border-t border-zinc-800/80 space-y-3">
                  <label className="block text-xs font-bold text-zinc-300 uppercase">
                    URL do Vídeo / Mídia de Cabeçalho (MP4)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="url"
                      placeholder="https://seu-dominio.com/video.mp4 ou link público de vídeo"
                      value={formData.metaHeaderUrl}
                      onChange={(e) => {
                        updateFormData({
                          metaHeaderUrl: e.target.value,
                          mediaUrl: e.target.value,
                          messageMode: 'video',
                        });
                      }}
                      className="flex-1 bg-black/60 border border-zinc-800 focus:border-cyan-500 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none transition-colors font-mono"
                    />
                  </div>
                  <p className="text-[11px] text-zinc-500">
                    O link deve ser acessível publicamente (HTTPS) com cabeçalho de vídeo MP4 válido.
                  </p>
                </div>

                {/* Texto Aprovado da Mensagem */}
                <div className="pt-4 border-t border-zinc-800/80 space-y-2">
                  <label className="block text-xs font-bold text-zinc-300 uppercase">
                    Texto Aprovado na Meta
                  </label>
                  <textarea
                    rows={6}
                    value={formData.messageTemplate}
                    onChange={(e) => updateFormData({ messageTemplate: e.target.value })}
                    className="w-full bg-black/60 border border-zinc-800 focus:border-cyan-500 rounded-xl p-3.5 text-xs sm:text-sm text-zinc-200 focus:outline-none transition-colors font-sans leading-relaxed"
                  />
                  <p className="text-[11px] text-zinc-500">
                    O texto deve corresponder ao template aprovado pela Meta no WhatsApp Business Manager.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* MODO 2: PROVEDOR EVOLUTION API (CHIP WHATSAPP TRADICIONAL) */
            <>
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

              {/* Upload e Mídia Conforme Formato */}
              {formData.messageMode === 'image' && (
                <div className="bg-zinc-900/40 p-5 rounded-3xl border border-zinc-800/60 space-y-3">
                  <span className="text-xs font-semibold text-zinc-300 block uppercase">
                    Anexo de Imagem
                  </span>
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <label className="flex-1 w-full flex items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed border-zinc-700 hover:border-cyan-400 cursor-pointer bg-black/40 transition-colors">
                      <Upload className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs text-zinc-300 font-medium">
                        {formData.mediaFileName || 'Clique para selecionar imagem'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageFile}
                        className="hidden"
                      />
                    </label>

                    {formData.mediaBase64 && (
                      <button
                        type="button"
                        onClick={() => updateFormData({ mediaBase64: '', mediaFileName: '' })}
                        className="p-3 bg-red-950/40 text-red-400 rounded-xl hover:bg-red-900/50 border border-red-800/40 cursor-pointer"
                        title="Remover imagem"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {formData.messageMode === 'video' && (
                <div className="bg-zinc-900/40 p-5 rounded-3xl border border-zinc-800/60 space-y-3">
                  <span className="text-xs font-semibold text-zinc-300 block uppercase">
                    Anexo de Vídeo (Máx 16MB)
                  </span>
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <label className="flex-1 w-full flex items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed border-zinc-700 hover:border-amber-400 cursor-pointer bg-black/40 transition-colors">
                      <Upload className="w-4 h-4 text-amber-400" />
                      <span className="text-xs text-zinc-300 font-medium">
                        {formData.mediaFileName || 'Clique para selecionar vídeo MP4'}
                      </span>
                      <input
                        type="file"
                        accept="video/mp4,video/webm"
                        onChange={handleVideoFile}
                        className="hidden"
                      />
                    </label>

                    {formData.mediaBase64 && (
                      <button
                        type="button"
                        onClick={() => updateFormData({ mediaBase64: '', mediaFileName: '' })}
                        className="p-3 bg-red-950/40 text-red-400 rounded-xl hover:bg-red-900/50 border border-red-800/40 cursor-pointer"
                        title="Remover vídeo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {formData.messageMode === 'audio' && (
                <div className="bg-zinc-900/40 p-5 rounded-3xl border border-zinc-800/60 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-300 uppercase">
                      Áudio / Mensagem de Voz
                    </span>
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-purple-300">
                      <input
                        type="checkbox"
                        checked={formData.isPtt}
                        onChange={(e) => updateFormData({ isPtt: e.target.checked })}
                        className="rounded border-zinc-700 text-purple-500 focus:ring-0"
                      />
                      <span>Enviar como Nota de Voz (PTT)</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Gravar com Microfone */}
                    <div className="p-4 rounded-2xl bg-black/50 border border-zinc-800 flex flex-col items-center justify-center gap-2">
                      {isRecording ? (
                        <>
                          <div className="flex items-center gap-2 text-red-400 text-xs font-bold animate-pulse">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                            Gravando ({recordingTime}s)
                          </div>
                          <button
                            type="button"
                            onClick={stopRecording}
                            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                          >
                            Finalizar Gravação
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={startRecording}
                          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        >
                          <Mic className="w-4 h-4" />
                          Gravar Microfone
                        </button>
                      )}
                    </div>

                    {/* Upload de Arquivo de Áudio */}
                    <label className="p-4 rounded-2xl border-2 border-dashed border-zinc-700 hover:border-purple-400 cursor-pointer bg-black/50 flex flex-col items-center justify-center gap-1.5 transition-colors">
                      <Upload className="w-4 h-4 text-purple-400" />
                      <span className="text-xs text-zinc-300 text-center truncate max-w-[200px]">
                        {formData.mediaFileName || 'Subir arquivo (.ogg, .mp3)'}
                      </span>
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={handleAudioFile}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Caixa de Texto do Template */}
              <div className="bg-zinc-900/40 p-5 rounded-3xl border border-zinc-800/60 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                    {formData.messageMode === 'text' ? 'Texto da Mensagem' : 'Legenda / Copy da Mídia'}
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {formData.messageTemplate.length} caracteres
                  </span>
                </div>

                {/* Variáveis e Helpers Rápidos */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase mr-1">Tags:</span>
                  <button
                    type="button"
                    onClick={() => insertTag('{{primeiro_nome|tudo bem}}')}
                    className="text-xs px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-emerald-300 border border-zinc-700 transition-colors cursor-pointer font-mono"
                  >
                    + {'{{primeiro_nome}}'}
                  </button>
                  <button
                    type="button"
                    onClick={() => insertTag('{{saudacao}}')}
                    className="text-xs px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-300 border border-zinc-700 transition-colors cursor-pointer font-mono"
                  >
                    + {'{{saudacao}}'}
                  </button>
                  <button
                    type="button"
                    onClick={() => insertTag('{Olá|Oi|Tudo bem}')}
                    className="text-xs px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-purple-300 border border-zinc-700 transition-colors cursor-pointer font-mono"
                  >
                    + Spintax
                  </button>
                  {formData.extraColumns.map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => insertTag(`{{${col}}}`)}
                      className="text-xs px-2 py-0.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-cyan-300 border border-zinc-700/60 transition-colors cursor-pointer font-mono"
                    >
                      + {col}
                    </button>
                  ))}
                </div>

                <textarea
                  rows={7}
                  value={formData.messageTemplate}
                  onChange={(e) => updateFormData({ messageTemplate: e.target.value })}
                  placeholder="Digite sua mensagem com variáveis. Ex: Olá {{primeiro_nome|amigo}}, {{saudacao}}!"
                  className="w-full bg-black/60 border border-zinc-800 focus:border-emerald-500 rounded-2xl p-4 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none transition-colors font-sans leading-relaxed resize-y"
                />

                {/* Opções de Personalização Segura */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-xs text-zinc-400">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.keepTitles}
                      onChange={(e) => updateFormData({ keepTitles: e.target.checked })}
                      className="rounded border-zinc-700 text-emerald-500 focus:ring-0"
                    />
                    <span>
                      Preservar títulos profissionais (<code className="text-emerald-400">Dr.</code>, <code className="text-emerald-400">Dra.</code>)
                    </span>
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
            </>
          )}
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

          {/* Simulador de Horário para Saudação (Modo Evolution) */}
          {!isMeta && (
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
          )}

          {/* Mockup do WhatsApp */}
          <div className="bg-[#0b141a] rounded-3xl border border-zinc-800 overflow-hidden shadow-2xl flex flex-col flex-1 min-h-[460px]">
            {/* Top Bar do Chat WhatsApp */}
            <div className="bg-[#202c33] px-4 py-3 flex items-center gap-3 border-b border-zinc-800/80">
              <div className="w-9 h-9 rounded-full bg-emerald-600/40 border border-emerald-500/30 flex items-center justify-center text-xs font-bold text-emerald-300 uppercase">
                {isMeta ? 'KV' : (top3Contacts[selectedPreviewIndex]?.name?.charAt(0) || 'W')}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-bold text-zinc-100 truncate">
                    {isMeta ? 'Kely Veloso' : (top3Contacts[selectedPreviewIndex]?.name || 'Destinatário')}
                  </p>
                  {isMeta && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400/20 shrink-0" />
                  )}
                </div>
                <p className="text-[10px] font-mono text-zinc-400 truncate">
                  {isMeta
                    ? 'Conta comercial oficial'
                    : `+${top3Contacts[selectedPreviewIndex]?.normalizedPhone || '55...'}`}
                </p>
              </div>
            </div>

            {/* Chat Body com Balão */}
            <div className="p-4 flex-1 flex flex-col justify-end bg-[radial-gradient(#1f2c34_1px,transparent_1px)] [background-size:16px_16px]">
              <div className="max-w-[90%] self-end bg-[#005c4b] text-zinc-100 rounded-2xl rounded-tr-sm p-3.5 shadow-md space-y-2 relative">
                
                {/* Cabeçalho de Vídeo no Balão (Meta Oficial ou Evolution) */}
                {formData.messageMode === 'video' && (
                  <div className="rounded-xl overflow-hidden mb-2 bg-black/60 border border-emerald-500/20 relative group">
                    {formData.metaHeaderUrl && formData.metaHeaderUrl.startsWith('http') ? (
                      <video
                        src={formData.metaHeaderUrl}
                        controls
                        className="w-full max-h-52 object-cover rounded-xl"
                      />
                    ) : (
                      <div className="w-full h-44 flex flex-col items-center justify-center bg-zinc-900 text-zinc-400 gap-2">
                        <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white">
                          <Play className="w-6 h-6 fill-white ml-0.5" />
                        </div>
                        <span className="text-[11px] font-semibold text-zinc-300">
                          Vídeo Oficial Aprovado da Campanha
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Cabeçalho de Imagem */}
                {formData.messageMode === 'image' && (formData.mediaBase64 || formData.mediaUrl) && (
                  <div className="rounded-xl overflow-hidden mb-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={formData.mediaBase64 || formData.mediaUrl}
                      alt="Anexo"
                      className="w-full max-h-48 object-cover rounded-xl"
                    />
                  </div>
                )}

                {/* Áudio */}
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
