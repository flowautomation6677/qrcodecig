'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, PlusCircle, Smartphone, LogOut } from 'lucide-react';

export default function Sidebar({ instanceName }: { instanceName: string }) {
  const pathname = usePathname();

  const menuItems = [
    { name: 'Dashboard', href: '/disparador', icon: LayoutDashboard },
    { name: 'Nova Campanha', href: '/disparador/novo', icon: PlusCircle },
  ];

  return (
    <aside className="w-64 bg-zinc-950 border-r border-zinc-800 flex flex-col min-h-screen">
      <div className="p-6">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Smartphone className="w-6 h-6 text-emerald-500" />
          NEXUS
        </h1>
        <p className="text-xs text-zinc-500 mt-1">Gerenciador de Campanhas</p>
      </div>

      <div className="px-4 mb-6">
        <div className="bg-zinc-900 rounded-xl p-3 border border-zinc-800">
          <p className="text-[10px] uppercase font-bold text-zinc-500 mb-1">Instância Conectada</p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
            <p className="text-sm font-medium text-emerald-400 truncate" title={instanceName}>
              {instanceName || 'Não conectada'}
            </p>
          </div>
        </div>
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

      <div className="p-4 border-t border-zinc-800">
        <Link
          href="/"
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-all font-medium text-sm"
        >
          <LogOut className="w-5 h-5" />
          Desconectar
        </Link>
      </div>
    </aside>
  );
}
