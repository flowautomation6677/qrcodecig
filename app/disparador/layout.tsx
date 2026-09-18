import React from 'react';
import Sidebar from '../components/Sidebar';

export const metadata = {
  title: 'NEXUS - Gerenciador de Campanhas',
  description: 'Ferramenta avançada para disparos e gerenciamento de campanhas.',
};

export default function DisparadorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const instanceName = process.env.EVOLUTION_INSTANCE_NAME || '';

  return (
    <div className="flex min-h-screen bg-black">
      <Sidebar instanceName={instanceName} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
