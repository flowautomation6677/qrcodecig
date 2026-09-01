import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Conectar WhatsApp | QR Code Evolution API',
  description: 'Sistema de conexão e sincronização de instâncias WhatsApp com Evolution API',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
