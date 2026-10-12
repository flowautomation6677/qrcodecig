import React, { Suspense } from 'react';
import Broadcaster from '../../components/Broadcaster';
import { RefreshCw } from 'lucide-react';

export const metadata = {
  title: 'Nova Campanha - NEXUS',
};

export default function NovaCampanhaPage() {
  const instanceName = process.env.EVOLUTION_INSTANCE_NAME || '';

  return (
    <div className="min-h-screen bg-black">
      <Suspense
        fallback={
          <div className="min-h-screen bg-black flex items-center justify-center text-zinc-400">
            <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
          </div>
        }
      >
        <Broadcaster instanceName={instanceName} />
      </Suspense>
    </div>
  );
}
