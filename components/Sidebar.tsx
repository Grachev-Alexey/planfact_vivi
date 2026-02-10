import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Receipt, PieChart, Settings, WalletCards, Users, Briefcase } from 'lucide-react';

export const Sidebar: React.FC = () => {
  const navItems = [
    { icon: LayoutDashboard, label: 'Показатели', path: '/' },
    { icon: Receipt, label: 'Операции', path: '/transactions' },
    { icon: Briefcase, label: 'Проекты', path: '/projects' },
    { icon: PieChart, label: 'Отчеты', path: '/reports' },
    { icon: WalletCards, label: 'Справочники', path: '/directories' },
  ];

  return (
    <aside className="w-16 hover:w-56 lg:w-56 bg-[#2c3e50] text-slate-300 flex flex-col h-screen fixed left-0 top-0 z-30 transition-all duration-300 overflow-hidden group">
      {/* Logo Area */}
      <div className="h-14 flex items-center px-4 bg-[#233140]">
        <div className="min-w-[32px] h-8 rounded bg-teal-500 text-white flex items-center justify-center font-bold text-lg">
          П
        </div>
        <span className="ml-3 font-semibold text-white tracking-wide opacity-0 group-hover:opacity-100 lg:opacity-100 transition-opacity whitespace-nowrap">
          ПФ ViVi
        </span>
      </div>

      <nav className="flex-1 py-4 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `
              flex items-center px-4 py-3 transition-colors border-l-4
              ${isActive 
                ? 'bg-[#34495e] text-white border-teal-500' 
                : 'border-transparent hover:bg-[#34495e] hover:text-white'}
            `}
          >
            <item.icon size={20} strokeWidth={1.5} className="min-w-[20px]" />
            <span className="ml-3 text-sm font-medium opacity-0 group-hover:opacity-100 lg:opacity-100 transition-opacity whitespace-nowrap">
              {item.label}
            </span>
          </NavLink>
        ))}
        
        <div className="mt-8 px-4 opacity-0 group-hover:opacity-100 lg:opacity-100 transition-opacity">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Настройки</p>
        </div>
        <NavLink
            to="/settings"
            className={({ isActive }) => `
              flex items-center px-4 py-3 transition-colors border-l-4
              ${isActive 
                ? 'bg-[#34495e] text-white border-teal-500' 
                : 'border-transparent hover:bg-[#34495e] hover:text-white'}
            `}
          >
            <Settings size={20} strokeWidth={1.5} className="min-w-[20px]" />
            <span className="ml-3 text-sm font-medium opacity-0 group-hover:opacity-100 lg:opacity-100 transition-opacity whitespace-nowrap">
              Настройки
            </span>
          </NavLink>
      </nav>

      <div className="p-4 border-t border-slate-700 bg-[#233140]">
        <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-500 flex items-center justify-center text-white font-bold text-xs">
                A
            </div>
            <div className="overflow-hidden opacity-0 group-hover:opacity-100 lg:opacity-100 transition-opacity">
                <div className="text-sm font-medium text-white truncate">rg1_vivi</div>
            </div>
        </div>
      </div>
    </aside>
  );
};