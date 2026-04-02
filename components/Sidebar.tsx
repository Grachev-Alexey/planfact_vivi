import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Receipt, PieChart, Settings, WalletCards, Menu, X, Send, BarChart2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const isPayoutController = user?.role === 'payout_controller';
  const isRequester = user?.role === 'requester';

  const navItems = isPayoutController ? [
    { icon: Send, label: 'Выплаты', path: '/payment-requests' },
    { icon: BarChart2, label: 'Мастера', path: '/master-stats' },
  ] : isRequester ? [
    { icon: Send, label: 'Выплаты', path: '/payment-requests' },
    { icon: BarChart2, label: 'Мастера', path: '/master-stats' },
  ] : [
    { icon: LayoutDashboard, label: 'Показатели', path: '/' },
    { icon: Receipt, label: 'Операции', path: '/transactions' },
    { icon: PieChart, label: 'Отчёты', path: '/reports' },
    { icon: WalletCards, label: 'Справочники', path: '/directories' },
    { icon: BarChart2, label: 'Мастера', path: '/master-stats' },
  ];

  const bottomItems = (isRequester || isPayoutController) ? [] : [
    { icon: Send, label: 'Выплаты', path: '/payment-requests' },
    { icon: Settings, label: 'Настройки', path: '/settings' },
  ];

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3 left-3 z-50 p-2 rounded-lg bg-[#1e2a38] text-white shadow-lg"
        aria-label="Открыть меню"
      >
        <Menu size={20} />
      </button>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 bg-black/40 z-40" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={`
        w-[72px] bg-[#1e2a38] text-slate-400 flex flex-col h-screen fixed left-0 top-0 z-50 shadow-xl
        transition-transform duration-200
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
      `}>
        <div className="h-14 flex items-center justify-center bg-[#172231] shrink-0 relative">
          <div className="rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold h-9 w-9 text-[10px]">
            ПФ
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden absolute right-1 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white"
          >
            <X size={16} />
          </button>
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

          {bottomItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center py-3 px-1 text-center border-l-[3px] ${
                  isActive
                    ? 'bg-white/10 text-white border-teal-400'
                    : 'border-transparent hover:bg-white/5 hover:text-slate-200'
                } ${item.path === '/settings' ? 'mb-2' : ''}`}
              >
                <item.icon size={20} strokeWidth={1.5} />
                <span className="text-[10px] mt-1 leading-tight font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
};
