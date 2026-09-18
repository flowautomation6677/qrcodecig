import React from 'react';
import Broadcaster from '../../components/Broadcaster';

export const metadata = {
  title: 'Nova Campanha - NEXUS',
};

export default function NovaCampanhaPage() {
  const instanceName = process.env.EVOLUTION_INSTANCE_NAME || '';

  return (
    <div className="min-h-screen bg-black">
      <Broadcaster instanceName={instanceName} />
    </div>
  );
}
