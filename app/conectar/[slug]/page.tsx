'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  Smartphone,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Lock,
} from 'lucide-react';

interface ClientInfo {
  id: string;
  name: string;
  slug: string;
  instanceName: string;
}

export default function ClientConnectPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [client, setClient] = useState<ClientInfo | null>(null);
  const [loadingClient, setLoadingClient] = useState(true);
  const [clientError, setClientError] = useState<string | null>(null);

  // Estados do QR Code
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loadingQr, setLoadingQr] = useState<boolean>(true);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(10);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const qrIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const statusIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Carrega dados do cliente pelo slug
  useEffect(() => {
    if (!slug) return;

    fetch(`/api/clients/by-slug?slug=${encodeURIComponent(slug)}`)
      .then((res) => {
        if (!res.ok) throw new Error('Cliente não encontrado ou link inválido.');
        return res.json();
      })
      .then((data) => {
        if (data.client) {
          setClient(data.client);
        } else {
          setClientError('Link de conexão inválido.');
        }
        setLoadingClient(false);
      })
      .catch((err) => {
        setClientError(err.message || 'Erro ao carregar dados do cliente.');
        setLoadingClient(false);
      });
  }, [slug]);

  const instanceName = client?.instanceName;

  // 2. Checa status da conexão
  const checkStatus = useCallback(async () => {
    if (!instanceName) return;

    try {
      const res = await fetch(`/api/whatsapp/status?instance=${encodeURIComponent(instanceName)}`);
      const statusData = await res.json();
      const state = statusData?.instance?.state || statusData?.state;

      if (state === 'open') {
        setIsConnected(true);
        setQrCode(null);
        setErrorMessage(null);
      } else if (state === 'close' || state === 'connecting') {
        setIsConnected(false);
      }
    } catch (error) {
      console.warn('Erro ao verificar status:', error);
    }
  }, [instanceName]);

  // 3. Busca novo QR Code
  const fetchQRCode = useCallback(async () => {
    if (!instanceName || isConnected) return;

    setLoadingQr(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/whatsapp/connect?instance=${encodeURIComponent(instanceName)}`);
      const qrData = await res.json();

      if (qrData?.instance?.state === 'open' || qrData?.state === 'open') {
        setIsConnected(true);
        setQrCode(null);
        return;
      }

      if (qrData.base64) {
        setQrCode(qrData.base64);
        setCountdown(45);
      } else if (qrData.qrcode?.base64) {
        setQrCode(qrData.qrcode.base64);
        setCountdown(45);
      } else if (qrData.code) {
        setQrCode(qrData.code);
        setCountdown(45);
      } else if (qrData.error) {
        setErrorMessage(qrData.error || 'Erro ao obter o QR Code.');
      }
    } catch (error: any) {
      setErrorMessage(error?.message || 'Falha ao conectar com o servidor.');
    } finally {
      setLoadingQr(false);
    }
  }, [instanceName, isConnected]);

  // Função para reiniciar e limpar sessão travada
  const handleReset = async () => {
    if (!instanceName) return;
    setLoadingQr(true);
    setErrorMessage(null);
    try {
      await fetch('/api/whatsapp/restart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instance: instanceName }),
      });
      await fetchQRCode();
    } catch {
      fetchQRCode();
    }
  };

  // 4. Polling e Ciclos de Renovação
  useEffect(() => {
    if (!instanceName || isConnected) return;

    // Checagem imediata
    checkStatus();
    fetchQRCode();

    // Polling de status a cada 3s (leve, apenas checa se abriu)
    statusIntervalRef.current = setInterval(checkStatus, 3000);

    // Renovação do QR a cada 45s (tempo seguro para evitar rejeição do WhatsApp)
    qrIntervalRef.current = setInterval(fetchQRCode, 45000);

    // Contagem regressiva visual
    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 45 : prev - 1));
    }, 1000);

    return () => {
      if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);
      if (qrIntervalRef.current) clearInterval(qrIntervalRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [instanceName, isConnected, checkStatus, fetchQRCode]);

  if (loadingClient) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-400 mb-3" />
        <p className="text-slate-400 text-sm">Carregando canal de conexão seguro...</p>
      </div>
    );
  }

  if (clientError || !client) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-red-900/50 rounded-2xl p-6 text-center shadow-xl">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-white mb-2">Link de Conexão Inválido</h2>
          <p className="text-slate-400 text-sm mb-6">
            {clientError || 'Este canal de conexão não existe ou foi desativado.'}
          </p>
          <p className="text-xs text-slate-500">
            Entre em contato com o suporte ou responsável pelos disparos para solicitar um novo link.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between items-center p-4 sm:p-6 lg:p-8">
      {/* Header Seguro e Isolado */}
      <header className="w-full max-w-lg flex items-center justify-between py-4 px-2 border-b border-slate-800/60 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Smartphone className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight leading-none">
              {client.name}
            </h1>
            <p className="text-xs text-emerald-400 font-medium mt-1 flex items-center gap-1">
              <Lock className="w-3 h-3" /> Conexão WhatsApp Oficial
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden sm:inline">Criptografia Ponta a Ponta</span>
        </div>
      </header>

      {/* Card Central */}
      <main className="w-full max-w-md my-auto">
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-sm">
          {isConnected ? (
            /* Estado: Conectado com Sucesso */
            <div className="flex flex-col items-center text-center py-6 animate-fade-in">
              <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center mb-5 shadow-lg shadow-emerald-500/30">
                <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">WhatsApp Conectado!</h2>
              <p className="text-sm text-slate-300 max-w-xs mb-6">
                A conexão do seu aparelho com a conta de <strong>{client.name}</strong> foi estabelecida com sucesso.
              </p>
              <div className="p-4 bg-emerald-950/40 border border-emerald-800/50 rounded-2xl w-full text-xs text-emerald-300">
                ✨ Seu número já está sincronizado. Você pode fechar esta página com segurança a qualquer momento.
              </div>
            </div>
          ) : (
            /* Estado: Escanear QR Code */
            <div className="flex flex-col items-center">
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-white mb-1">Escaneie o QR Code</h2>
                <p className="text-xs text-slate-400">
                  Siga as instruções abaixo para vincular o WhatsApp
                </p>
              </div>

              {/* Box do QR Code */}
              <div className="relative w-64 h-64 bg-white rounded-2xl p-3 flex items-center justify-center shadow-inner overflow-hidden border-4 border-slate-800">
                {loadingQr && !qrCode ? (
                  <div className="flex flex-col items-center gap-2 text-slate-600">
                    <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
                    <span className="text-xs font-medium">Gerando QR Code...</span>
                  </div>
                ) : errorMessage ? (
                  <div className="text-center p-3 text-red-600">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-xs font-semibold">{errorMessage}</p>
                    <button
                      onClick={fetchQRCode}
                      className="mt-3 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs hover:bg-slate-800"
                    >
                      Tentar Novamente
                    </button>
                  </div>
                ) : qrCode ? (
                  <img
                    src={qrCode.startsWith('data:image') ? qrCode : `data:image/png;base64,${qrCode}`}
                    alt="QR Code WhatsApp"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center text-slate-400">
                    <QrCode className="w-12 h-12 mb-2" />
                    <span className="text-xs">Aguardando código...</span>
                  </div>
                )}
              </div>

              {/* Barra de Progresso / Tempo de Atualização */}
              {!isConnected && qrCode && (
                <div className="w-full mt-4 flex items-center justify-between text-xs text-slate-400 px-2">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    Atualizando automaticamente em
                  </span>
                  <span className="font-mono font-bold text-emerald-400">{countdown}s</span>
                </div>
              )}

              {/* Instruções Passo a Passo */}
              <div className="w-full mt-6 space-y-2.5 text-xs text-slate-300 bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
                <p className="font-semibold text-white mb-2 flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-emerald-400" /> Como conectar:
                </p>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[10px]">
                    1
                  </span>
                  <span>Abra o <strong>WhatsApp</strong> no seu celular</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[10px]">
                    2
                  </span>
                  <span>Toque em <strong>Configurações</strong> ou nos <strong>três pontinhos</strong></span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[10px]">
                    3
                  </span>
                  <span>Selecione <strong>Aparelhos conectados</strong> &gt; <strong>Conectar um aparelho</strong></span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[10px]">
                    4
                  </span>
                  <span>Aponte a câmera para o QR Code acima</span>
                </div>
              </div>

              {/* Botão de Reset e Dicas Anti-Erro */}
              <div className="w-full mt-4 space-y-3">
                <button
                  onClick={handleReset}
                  disabled={loadingQr}
                  className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700/80 text-slate-300 hover:text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all border border-slate-700/60 disabled:opacity-50"
                  title="Limpa qualquer sessão travada e gera um QR Code novo"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${loadingQr ? 'animate-spin' : ''}`} />
                  <span>Gerar Novo QR Code / Reiniciar Sessão</span>
                </button>

                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-300/90 space-y-1">
                  <p className="font-bold flex items-center gap-1 text-amber-300">
                    ⚠️ Deu &quot;Não foi possível conectar o dispositivo&quot;?
                  </p>
                  <p>1. Verifique se o seu WhatsApp já possui <strong>4 aparelhos conectados</strong> (desconecte computadores antigos).</p>
                  <p>2. Clique no botão acima para <strong>Reiniciar Sessão</strong> e aponte a câmera com o novo código.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer Limpo e Profissional */}
      <footer className="w-full max-w-lg py-4 text-center text-xs text-slate-500 border-t border-slate-800/40 mt-6">
        <p>© {new Date().getFullYear()} Conexão Segura WhatsApp. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}
