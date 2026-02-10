import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Receipt, PieChart, Settings, WalletCards, ChevronLeft, ChevronRight } from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
  const location = useLocation();
  const navItems = [
    { icon: LayoutDashboard, label: 'Показатели', path: '/' },
    { icon: Receipt, label: 'Операции', path: '/transactions' },
    { icon: PieChart, label: 'Отчеты', path: '/reports' },
    { icon: WalletCards, label: 'Справочники', path: '/directories' },
  ];

  return (
    <aside
      className={`${collapsed ? 'w-16' : 'w-56'} bg-[#2c3e50] text-slate-300 flex flex-col h-screen fixed left-0 top-0 z-30 transition-all duration-300 overflow-hidden shadow-xl`}
    >
      <div className="h-14 flex items-center bg-[#233140] shrink-0 relative">
        <div className={`flex items-center justify-center ${collapsed ? 'w-full px-2' : 'px-4 w-full'}`}>
          <div className={`rounded bg-teal-600 text-white flex items-center justify-center font-bold transition-all duration-300 ${collapsed ? 'h-9 w-9 text-[10px] leading-tight' : 'h-9 px-3 text-sm'}`}>
            {collapsed ? (
              <span className="leading-none">ПФ</span>
            ) : (
              <span className="whitespace-nowrap">ПланФакт ViVi</span>
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
              title={collapsed ? item.label : undefined}
              className={`
                flex items-center px-4 py-3 transition-colors border-l-4
                ${isActive
                  ? 'bg-[#34495e] text-white border-teal-500'
                  : 'border-transparent hover:bg-[#34495e] hover:text-white'}
              `}
            >
              <item.icon size={20} strokeWidth={1.5} className="min-w-[20px]" />
              {!collapsed && (
                <span className="ml-3 text-sm font-medium whitespace-nowrap">
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}

        <div className={`mt-8 px-4 ${collapsed ? 'hidden' : ''}`}>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Настройки</p>
        </div>
        <Link
          to="/settings"
          title={collapsed ? 'Настройки' : undefined}
          className={`
            flex items-center px-4 py-3 transition-colors border-l-4
            ${location.pathname === '/settings'
              ? 'bg-[#34495e] text-white border-teal-500'
              : 'border-transparent hover:bg-[#34495e] hover:text-white'}
          `}
        >
          <Settings size={20} strokeWidth={1.5} className="min-w-[20px]" />
          {!collapsed && (
            <span className="ml-3 text-sm font-medium whitespace-nowrap">
              Настройки
            </span>
          )}
        </Link>
      </nav>

      <button
        onClick={onToggle}
        className="h-10 flex items-center justify-center border-t border-slate-600/50 text-slate-400 hover:text-white hover:bg-[#34495e] transition-colors shrink-0"
        title={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
      >
        {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>
    </aside>
  );
};
