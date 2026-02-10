import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Receipt, PieChart, Settings, WalletCards } from 'lucide-react';

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const navItems = [
    { icon: LayoutDashboard, label: 'Показатели', path: '/' },
    { icon: Receipt, label: 'Операции', path: '/transactions' },
    { icon: PieChart, label: 'Отчёты', path: '/reports' },
    { icon: WalletCards, label: 'Справочники', path: '/directories' },
  ];

  return (
    <aside className="w-[72px] bg-[#1e2a38] text-slate-400 flex flex-col h-screen fixed left-0 top-0 z-30 shadow-xl">
      <div className="h-14 flex items-center justify-center bg-[#172231] shrink-0">
        <div className="rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold h-9 w-9 text-[10px]">
          ПФ
        </div>
      </div>

      <nav className="flex-1 pt-2 flex flex-col">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center py-3 px-1 text-center border-l-[3px] ${
                isActive
                  ? 'bg-white/10 text-white border-teal-400'
                  : 'border-transparent hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              <item.icon size={20} strokeWidth={1.5} />
              <span className="text-[10px] mt-1 leading-tight font-medium">{item.label}</span>
            </Link>
          );
        })}

        <div className="flex-1" />

        <Link
          to="/settings"
          className={`flex flex-col items-center py-3 px-1 text-center border-l-[3px] mb-2 ${
            location.pathname === '/settings'
              ? 'bg-white/10 text-white border-teal-400'
              : 'border-transparent hover:bg-white/5 hover:text-slate-200'
          }`}
        >
          <Settings size={20} strokeWidth={1.5} />
          <span className="text-[10px] mt-1 leading-tight font-medium">Настройки</span>
        </Link>
      </nav>
    </aside>
  );
};
