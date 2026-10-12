'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, PlusCircle, Smartphone, Users, QrCode } from 'lucide-react';

export default function Sidebar({ instanceName }: { instanceName: string }) {
  const pathname = usePathname();

  const menuItems = [
    { name: 'Escolher Cliente', href: '/disparador/clientes', icon: Users },
    { name: 'Nova Campanha', href: '/disparador/novo', icon: PlusCircle },
    { name: 'Painel Geral', href: '/disparador', icon: LayoutDashboard },
  ];

  return (
    <aside className="w-64 bg-zinc-950 border-r border-zinc-800 flex flex-col min-h-screen">
      <div className="p-6">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Smartphone className="w-6 h-6 text-emerald-500" />
          DISPARADOR
        </h1>
        <p className="text-xs text-zinc-500 mt-1">Gestão de Disparos WhatsApp</p>
      </div>

      <div className="px-4 mb-6">
        <Link
          href="/disparador/clientes"
          className="block bg-zinc-900 hover:bg-zinc-800/80 rounded-xl p-3 border border-zinc-800 transition-colors group"
        >
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] uppercase font-bold text-zinc-500">Gestão Multicliente</p>
            <span className="text-[10px] text-emerald-400 group-hover:underline">Gerenciar &rarr;</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
            <p className="text-xs font-medium text-emerald-400 truncate" title={instanceName}>
              {instanceName || 'Instância Ativa'}
            </p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 px-4 space-y-2">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${
                isActive
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <Icon className="w-5 h-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-zinc-800 space-y-2">
        <Link
          href="/disparador/clientes"
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
        >
          <QrCode className="w-4 h-4 text-emerald-400" />
          <span>Links de QR Code</span>
        </Link>
      </div>
    </aside>
  );
}
