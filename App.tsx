import React, { useState } from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import { FinanceProvider, useFinance } from './context/FinanceContext';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { TransactionList } from './components/TransactionList';
import { Button } from './components/ui/Button';
import { Modal } from './components/ui/Modal';
import { TransactionForm } from './components/TransactionForm';
import { Plus, Bell, HelpCircle } from 'lucide-react';
import { formatCurrency } from './utils/format';

const TopBar: React.FC = () => {
  const { getTotalBalance } = useFinance();
  return (
    <div className="h-14 bg-[#34495e] text-white flex items-center justify-between px-6 shadow-md fixed top-0 right-0 left-0 lg:left-56 z-20 transition-all duration-300">
       <div className="flex items-center gap-4">
          {/* Left side items removed */}
       </div>
       <div className="flex items-center gap-6">
          <div className="flex flex-col items-end mr-4">
             <span className="text-xs text-yellow-400 font-medium">На счетах {formatCurrency(getTotalBalance())}</span>
             <span className="text-[10px] text-slate-400">Разрыв с 01.03.26</span>
          </div>
          <button className="text-slate-300 hover:text-white">
             <Bell size={18} />
          </button>
       </div>
    </div>
  )
}

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="flex min-h-screen bg-[#F0F2F5]">
      <Sidebar />
      <TopBar />
      <main className="flex-1 ml-16 lg:ml-56 mt-14 p-0 transition-all duration-300">
        {children}
      </main>
    </div>
  );
};

const AccountsPage = () => (
  <div className="p-8">
     <div className="bg-white p-12 rounded shadow-sm border border-slate-200 text-center">
        <h3 className="text-xl font-bold text-slate-700">Справочники</h3>
        <p className="text-slate-500 mt-2">Управление контрагентами, статьями и проектами.</p>
    </div>
  </div>
);

const ReportsPage = () => (
   <div className="p-8">
    <div className="bg-white p-12 rounded shadow-sm border border-slate-200 text-center">
        <h3 className="text-xl font-bold text-slate-700">Отчеты</h3>
        <p className="text-slate-500 mt-2">P&L (ПиУ), ДДС и другие финансовые отчеты.</p>
    </div>
  </div>
);

const App: React.FC = () => {
  return (
    <FinanceProvider>
      <HashRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/transactions" element={<TransactionList />} />
            <Route path="/projects" element={<AccountsPage />} />
            <Route path="/directories" element={<AccountsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/settings" element={<AccountsPage />} />
          </Routes>
        </Layout>
      </HashRouter>
    </FinanceProvider>
  );
};

export default App;