'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import WhatsAppConnect from './components/WhatsAppConnect';
import { Smartphone, Shield, RefreshCw } from 'lucide-react';

function ConnectPageContent() {
  const searchParams = useSearchParams();
  const queryInstance = searchParams.get('instance') || searchParams.get('numero') || searchParams.get('phone') || '';

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-between items-center p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <header className="w-full max-w-4xl flex items-center justify-between py-4 px-2 border-b border-slate-800/60 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Smartphone className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight leading-none">
              Conexão WhatsApp
            </h1>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Evolution API Gateway
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-400">
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden sm:inline">Conexão Segura</span>
        </div>
      </header>

      {/* Main QR Code Center Card */}
      <main className="w-full max-w-md flex flex-col items-center justify-center my-auto py-2">
        <WhatsAppConnect initialInstance={queryInstance} />
        
        <div className="mt-8 w-full">
          <a 
            href="/disparador" 
            className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white rounded-2xl font-bold shadow-lg shadow-emerald-900/50 transition-all hover:-translate-y-1"
          >
            Acessar Ferramenta de Disparos
          </a>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-4xl py-4 text-center text-xs text-slate-500 border-t border-slate-800/40 mt-8">
        <p>© {new Date().getFullYear()} Sistema de Conexão WhatsApp. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
      </div>
    }>
      <ConnectPageContent />
    </Suspense>
  );
}
