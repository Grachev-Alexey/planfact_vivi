import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Receipt, PieChart, Settings, WalletCards } from 'lucide-react';

interface SidebarProps {
  expanded: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ expanded, onMouseEnter, onMouseLeave }) => {
  const location = useLocation();
  const navItems = [
    { icon: LayoutDashboard, label: 'Показатели', path: '/' },
    { icon: Receipt, label: 'Операции', path: '/transactions' },
    { icon: PieChart, label: 'Отчеты', path: '/reports' },
    { icon: WalletCards, label: 'Справочники', path: '/directories' },
  ];

  return (
    <aside
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`${expanded ? 'w-56' : 'w-16'} bg-[#1e2a38] text-slate-300 flex flex-col h-screen fixed left-0 top-0 z-30 sidebar-transition overflow-hidden shadow-xl`}
    >
      <div className="h-14 flex items-center bg-[#172231] shrink-0">
        <div className={`flex items-center ${expanded ? 'px-4' : 'justify-center w-full px-2'}`}>
          <div className={`rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold transition-all duration-300 ${expanded ? 'h-9 px-3 text-sm' : 'h-9 w-9 text-[10px]'}`}>
            {expanded ? (
              <span className="whitespace-nowrap">ПланФакт ViVi</span>
            ) : (
              <span className="leading-none">ПФ</span>
            )}
          </div>
        </div>
      </div>

      <nav className="flex-1 py-4 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              title={!expanded ? item.label : undefined}
              className={`
                flex items-center px-4 py-3 transition-colors border-l-4
                ${isActive
                  ? 'bg-white/10 text-white border-teal-400'
                  : 'border-transparent hover:bg-white/5 hover:text-white'}
              `}
            >
              <item.icon size={20} strokeWidth={1.5} className="min-w-[20px]" />
              <span className={`ml-3 text-sm font-medium whitespace-nowrap transition-opacity duration-200 ${expanded ? 'opacity-100' : 'opacity-0 w-0'}`}>
                {item.label}
              </span>
            </Link>
          );
        })}

        {expanded && (
          <div className="mt-8 px-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Система</p>
          </div>
        )}
        <Link
          to="/settings"
          title={!expanded ? 'Настройки' : undefined}
          className={`
            flex items-center px-4 py-3 transition-colors border-l-4
            ${location.pathname === '/settings'
              ? 'bg-white/10 text-white border-teal-400'
              : 'border-transparent hover:bg-white/5 hover:text-white'}
          `}
        >
          <Settings size={20} strokeWidth={1.5} className="min-w-[20px]" />
          <span className={`ml-3 text-sm font-medium whitespace-nowrap transition-opacity duration-200 ${expanded ? 'opacity-100' : 'opacity-0 w-0'}`}>
            Настройки
          </span>
        </Link>
      </nav>
    </aside>
  );
};
