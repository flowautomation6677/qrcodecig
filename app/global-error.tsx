'use client';

import React from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR" className="dark">
      <body
        style={{
          margin: 0,
          padding: '24px',
          backgroundColor: '#09090b',
          color: '#ffffff',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            maxWidth: '440px',
            width: '100%',
            backgroundColor: '#18181b',
            border: '1px solid #27272a',
            borderRadius: '24px',
            padding: '32px',
            textAlign: 'center',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px auto',
              fontSize: '24px',
            }}
          >
            ⚠️
          </div>

          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 8px 0', color: '#ffffff' }}>
            Erro no Carregamento do Aplicativo
          </h2>

          <p style={{ fontSize: '13px', color: '#a1a1aa', margin: '0 0 20px 0', lineHeight: 1.5 }}>
            Ocorreu uma falha inesperada durante a execução da interface.
          </p>

          {error?.message && (
            <div
              style={{
                backgroundColor: 'rgba(69, 10, 10, 0.4)',
                border: '1px solid rgba(153, 27, 27, 0.6)',
                borderRadius: '12px',
                padding: '12px',
                textAlign: 'left',
                fontSize: '12px',
                fontFamily: 'monospace',
                color: '#fca5a5',
                wordBreak: 'break-word',
                maxHeight: '120px',
                overflowY: 'auto',
                marginBottom: '24px',
              }}
            >
              {error.message}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              onClick={() => reset()}
              style={{
                width: '100%',
                padding: '12px 16px',
                backgroundColor: '#10b981',
                color: '#000000',
                fontWeight: 700,
                fontSize: '13px',
                borderRadius: '12px',
                border: 'none',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
              }}
            >
              Recarregar Tela
            </button>

            <a
              href="/disparador/clientes"
              style={{
                display: 'block',
                width: '100%',
                boxSizing: 'border-box',
                padding: '12px 16px',
                backgroundColor: '#27272a',
                color: '#e4e4e7',
                fontWeight: 600,
                fontSize: '13px',
                borderRadius: '12px',
                border: '1px solid #3f3f46',
                textDecoration: 'none',
              }}
            >
              Voltar ao Início
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
