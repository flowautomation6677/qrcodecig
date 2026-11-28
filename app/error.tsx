'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled client exception caught by ErrorBoundary:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto shadow-inner">
          <AlertTriangle className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-white tracking-tight">
            Ops! Ocorreu um erro no aplicativo
          </h2>
          <p className="text-xs text-slate-400">
            Houve uma falha inesperada durante a exibição desta tela.
          </p>
          {error?.message && (
            <div className="mt-3 p-3 bg-red-950/40 border border-red-900/60 rounded-xl text-left text-xs font-mono text-red-300 break-words max-h-32 overflow-y-auto">
              {error.message}
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <button
            onClick={() => reset()}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold rounded-xl text-xs transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Tentar Novamente
          </button>

          <Link
            href="/disparador/clientes"
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs transition-colors border border-slate-700"
          >
            <Home className="w-4 h-4" />
            Voltar ao Início
          </Link>
        </div>
      </div>
    </div>
  );
}
