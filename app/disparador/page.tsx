import React from 'react';
import Broadcaster from '../components/Broadcaster';

export const metadata = {
  title: 'Disparador em Massa - Evolution API',
  description: 'Ferramenta segura para disparos de WhatsApp',
};

export default function DisparadorPage() {
  const instanceName = process.env.EVOLUTION_INSTANCE_NAME || '';

  return (
    <main className="min-h-screen bg-black">
      <Broadcaster instanceName={instanceName} />
    </main>
  );
}
