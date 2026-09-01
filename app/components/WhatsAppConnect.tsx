'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  CheckCircle2, 
  QrCode as QrIcon, 
  RefreshCw, 
  Smartphone, 
  Wifi, 
  AlertCircle, 
  Copy, 
  Check, 
  LogOut,
  ShieldCheck,
  CheckCircle
} from 'lucide-react';

interface WhatsAppConnectProps {
  initialInstance?: string;
}

export default function WhatsAppConnect({ initialInstance = '' }: WhatsAppConnectProps) {
  const [instanceName, setInstanceName] = useState<string>(initialInstance);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'qr' | 'connected' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState<number>(10);
  const [isRefreshingManual, setIsRefreshingManual] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const statusIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Busca o status da conexão
  const checkStatus = useCallback(async () => {
    try {
      const url = instanceName 
        ? `/api/whatsapp/status?instance=${encodeURIComponent(instanceName)}`
        : `/api/whatsapp/status`;
      
      const statusRes = await fetch(url, { cache: 'no-store' });
      const statusData = await statusRes.json();

      const state = statusData?.instance?.state || statusData?.state;

      if (state === 'open') {
        setStatus('connected');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Erro ao verificar status:', error);
      return false;
    }
  }, [instanceName]);

  // 2. Busca um novo QR Code da Evolution API
  const fetchQRCode = useCallback(async () => {
    try {
      const url = instanceName 
        ? `/api/whatsapp/connect?instance=${encodeURIComponent(instanceName)}`
        : `/api/whatsapp/connect`;

      const qrRes = await fetch(url, { cache: 'no-store' });
      const qrData = await qrRes.json();

      if (!qrRes.ok) {
        throw new Error(qrData?.error || qrData?.details || 'Não foi possível gerar o QR Code');
      }

      if (qrData.resolvedInstance && !instanceName) {
        setInstanceName(qrData.resolvedInstance);
      }

      // Se já estiver conectado
      if (qrData?.instance?.state === 'open' || qrData?.state === 'open') {
        setStatus('connected');
        return;
      }

      const rawBase64 = qrData.base64 || qrData.qrcode?.base64;
      const rawCode = qrData.code || qrData.pairingCode || qrData.qrcode?.code;

      if (rawBase64) {
        const formattedBase64 = rawBase64.startsWith('data:image')
          ? rawBase64
          : `data:image/png;base64,${rawBase64}`;
        
        setQrCode(formattedBase64);
        setPairingCode(rawCode || null);
        setStatus('qr');
        setErrorMessage('');
      } else if (rawCode) {
        setPairingCode(rawCode);
        setStatus('qr');
        setErrorMessage('');
      } else {
        setStatus('loading');
      }
    } catch (error: any) {
      console.error('Erro ao buscar QR Code:', error);
      setErrorMessage(error?.message || 'Erro ao comunicar com a Evolution API');
      setStatus('error');
    }
  }, [instanceName]);

  // Atualização manual
  const handleManualRefresh = async () => {
    setIsRefreshingManual(true);
    setCountdown(10);
    const isConnected = await checkStatus();
    if (!isConnected) {
      await fetchQRCode();
    }
    setTimeout(() => setIsRefreshingManual(false), 500);
  };

  // Desconectar instância
  const handleDisconnect = async () => {
    if (!confirm('Deseja realmente desconectar esta instância do WhatsApp?')) return;
    setIsDisconnecting(true);
    try {
      const res = await fetch('/api/whatsapp/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instance: instanceName }),
      });
      if (res.ok) {
        setStatus('loading');
        setQrCode(null);
        setCountdown(10);
        await fetchQRCode();
      } else {
        const data = await res.json();
        alert(data.error || 'Erro ao desconectar');
      }
    } catch (e) {
      alert('Falha na requisição de desconexão');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const copyInstanceToClipboard = () => {
    if (!instanceName) return;
    navigator.clipboard.writeText(instanceName);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Efeito principal: Polling de Status (a cada 3s) e Atualização de QR Code (a cada 10s)
  useEffect(() => {
    let isSubscribed = true;

    const init = async () => {
      setStatus('loading');
      const isConnected = await checkStatus();
      if (!isConnected && isSubscribed) {
        await fetchQRCode();
      }
    };

    init();

    // 1. Polling de status a cada 3 segundos
    statusIntervalRef.current = setInterval(async () => {
      if (status !== 'connected') {
        const isConnected = await checkStatus();
        if (isConnected) {
          clearInterval(statusIntervalRef.current as NodeJS.Timeout);
          clearInterval(countdownIntervalRef.current as NodeJS.Timeout);
        }
      }
    }, 3000);

    // 2. Timer de contagem regressiva de 10s para renovação contínua do QR Code
    setCountdown(10);
    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchQRCode();
          return 10;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      isSubscribed = false;
      if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [checkStatus, fetchQRCode]);

  return (
    <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 backdrop-blur-xl rounded-3xl shadow-2xl p-6 sm:p-8 relative overflow-hidden transition-all duration-300 hover:border-slate-700/80">
      {/* Luz ambiente decorativa de fundo */}
      <div className="absolute -top-24 -right-24 w-52 h-52 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-52 h-52 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Cabeçalho */}
      <div className="flex flex-col items-center text-center mb-6">
        <div className="flex items-center justify-between w-full mb-4">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${
            status === 'connected' 
              ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/80' 
              : status === 'error'
              ? 'bg-red-950/80 text-red-400 border-red-800/80'
              : 'bg-amber-950/80 text-amber-300 border-amber-800/80'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full mr-2 ${
              status === 'connected' 
                ? 'bg-emerald-400 animate-pulse' 
                : status === 'error'
                ? 'bg-red-400'
                : 'bg-amber-400 animate-ping'
            }`} />
            {status === 'connected' ? 'Conectado' : status === 'error' ? 'Falha' : 'Aguardando Leitura'}
          </span>

          <button
            onClick={handleManualRefresh}
            disabled={isRefreshingManual || status === 'connected'}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 rounded-xl transition-colors disabled:opacity-40"
            title="Recarregar QR Code agora"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshingManual ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <Smartphone className="w-6 h-6 text-emerald-400" />
          Conectar WhatsApp
        </h2>

        {instanceName && (
          <div className="mt-2.5 flex items-center gap-1.5 bg-slate-950/60 border border-slate-800 px-3 py-1 rounded-lg text-xs text-slate-400">
            <span className="text-slate-500">Instância:</span>
            <span className="font-mono text-emerald-400 font-medium truncate max-w-[180px]">
              {instanceName}
            </span>
            <button 
              onClick={copyInstanceToClipboard} 
              className="hover:text-slate-200 ml-0.5 p-0.5" 
              title="Copiar nome da instância"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}
      </div>

      {/* Conteúdo de acordo com o Status */}
      <div className="flex flex-col items-center justify-center">
        {/* ESTADO: CARREGANDO */}
        {status === 'loading' && (
          <div className="flex flex-col items-center py-8">
            <div className="relative w-56 h-56 bg-slate-800/50 border border-slate-700/50 rounded-2xl flex flex-col items-center justify-center overflow-hidden animate-pulse">
              <QrIcon className="w-16 h-16 text-slate-600 mb-2" />
              <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="mt-5 text-sm text-slate-400 font-medium">
              Gerando QR Code...
            </p>
          </div>
        )}

        {/* ESTADO: QR CODE PRONTO PARA LEITURA */}
        {status === 'qr' && (
          <div className="flex flex-col items-center w-full">
            <div className="relative group">
              <div className="p-3.5 bg-white rounded-2xl shadow-2xl border-4 border-slate-800 transition-transform duration-300 group-hover:scale-[1.01]">
                {qrCode ? (
                  <img 
                    src={qrCode} 
                    alt="QR Code WhatsApp" 
                    className="w-56 h-56 object-contain rounded-lg"
                  />
                ) : (
                  <div className="w-56 h-56 flex flex-col items-center justify-center text-slate-700 text-center p-4">
                    <QrIcon className="w-12 h-12 mb-2 text-slate-400" />
                    <span className="text-xs font-mono">{pairingCode || 'Código de Pareamento'}</span>
                  </div>
                )}
              </div>

              {/* Indicador de leitura ativa */}
              <div className="absolute -bottom-3 -right-3 bg-emerald-500 text-slate-950 p-2.5 rounded-full shadow-lg border-2 border-slate-900">
                <Wifi className="w-4 h-4 animate-pulse" />
              </div>
            </div>

            {/* Barra de Progresso e Contador de 10s */}
            <div className="w-full mt-6 space-y-2">
              <div className="flex justify-between items-center text-xs text-slate-400 font-medium">
                <span className="flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-400 animate-spin-slow" />
                  Atualização a cada 10s
                </span>
                <span className="font-mono text-emerald-400 font-semibold">
                  {countdown}s
                </span>
              </div>

              <div className="w-full bg-slate-800/80 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="bg-emerald-500 h-full rounded-full transition-all duration-1000 ease-linear"
                  style={{ width: `${(countdown / 10) * 100}%` }}
                />
              </div>
            </div>

            {/* Instruções passo a passo */}
            <div className="mt-6 p-4 bg-slate-950/70 border border-slate-800/80 rounded-2xl text-left text-xs text-slate-400 space-y-2 w-full">
              <p className="font-semibold text-slate-200 flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                Como escanear:
              </p>
              <ol className="list-decimal list-inside space-y-1.5 pl-1 text-slate-300">
                <li>Abra o WhatsApp no seu smartphone</li>
                <li>Toque nos <strong>três pontos</strong> ou em <strong>Configurações</strong></li>
                <li>Selecione <strong>Aparelhos conectados</strong></li>
                <li>Toque em <strong>Conectar um aparelho</strong> e aponte para a tela</li>
              </ol>
            </div>
          </div>
        )}

        {/* ESTADO: CONECTADO COM SUCESSO */}
        {status === 'connected' && (
          <div className="flex flex-col items-center py-6 text-center animate-fade-in w-full">
            <div className="relative mb-5">
              <div className="w-20 h-20 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/10">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-slate-950 p-1.5 rounded-full border-2 border-slate-900">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>

            <h3 className="text-xl font-bold text-white mb-1.5">
              Dispositivo Conectado!
            </h3>
            <p className="text-slate-400 text-sm max-w-xs leading-relaxed">
              O WhatsApp já está conectado e sincronizado com a Evolution API.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row gap-3 w-full">
              <button
                onClick={handleDisconnect}
                disabled={isDisconnecting}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800/80 hover:bg-red-950/60 text-slate-300 hover:text-red-300 border border-slate-700/60 hover:border-red-800/80 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
              >
                <LogOut className="w-4 h-4" />
                {isDisconnecting ? 'Desconectando...' : 'Desconectar'}
              </button>

              <button
                onClick={handleManualRefresh}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-950/50 transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                Atualizar Status
              </button>
            </div>
          </div>
        )}

        {/* ESTADO: ERRO */}
        {status === 'error' && (
          <div className="flex flex-col items-center py-6 text-center w-full">
            <div className="w-16 h-16 bg-red-500/20 border border-red-500/30 text-red-400 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8" />
            </div>

            <h3 className="text-lg font-bold text-white mb-1.5">
              Falha na Conexão
            </h3>
            <p className="text-slate-400 text-xs max-w-xs mb-5 leading-relaxed">
              {errorMessage || 'Não foi possível carregar a instância. Verifique se a variável EVOLUTION_INSTANCE_NAME está configurada corretamente.'}
            </p>

            <button
              onClick={handleManualRefresh}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Tentar Novamente
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
