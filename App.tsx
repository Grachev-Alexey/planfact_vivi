import React, { useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { FinanceProvider, useFinance } from './context/FinanceContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { TransactionList } from './components/TransactionList';
import { Directories } from './components/Directories';
import { Settings } from './components/Settings';
import { LoginPage } from './components/LoginPage';
import { Button } from './components/ui/Button';
import { Modal } from './components/ui/Modal';
import { TransactionForm } from './components/TransactionForm';
import { Plus, Bell, HelpCircle, LogOut } from 'lucide-react';
import { formatCurrency } from './utils/format';

const TopBar: React.FC = () => {
  const { getTotalBalance } = useFinance();
  const { user, logout } = useAuth();
  
  return (
    <div className="h-14 bg-[#34495e] text-white flex items-center justify-between px-4 lg:px-6 shadow-md fixed top-0 right-0 left-16 xl:left-56 z-20 transition-all duration-300">
       <div className="flex items-center gap-4">
          {/* Left side items */}
       </div>
       <div className="flex items-center gap-6">
          <div className="flex flex-col items-end mr-0 md:mr-4">
             <span className="text-xs text-yellow-400 font-medium whitespace-nowrap">На счетах {formatCurrency(getTotalBalance())}</span>
             <span className="text-[10px] text-slate-400 hidden md:inline">Разрыв с 01.03.26</span>
          </div>
          <button className="text-slate-300 hover:text-white">
             <Bell size={18} />
          </button>
          <div className="h-6 w-px bg-slate-600 mx-2"></div>
          <div className="flex items-center gap-2">
             <span className="text-xs font-medium">{user?.username}</span>
             <button onClick={logout} className="text-slate-400 hover:text-rose-400" title="Выйти">
                <LogOut size={16} />
             </button>
          </div>
       </div>
    </div>
  )
}

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <TopBar />
      <main className="flex-1 ml-16 xl:ml-56 mt-14 p-0 transition-all duration-300">
        {children}
      </main>
    </div>
  );
};

const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
};

const ReportsPage = () => (
   <div className="p-8">
    <div className="bg-white p-12 rounded shadow-sm border border-slate-200 text-center">
        <h3 className="text-xl font-bold text-slate-700">Отчеты</h3>
        <p className="text-slate-500 mt-2">P&L (ПиУ), ДДС и другие финансовые отчеты.</p>
    </div>
  </div>
);

const AppRoutes = () => {
    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/transactions" element={<ProtectedRoute><Layout><TransactionList /></Layout></ProtectedRoute>} />
            <Route path="/directories" element={<ProtectedRoute><Layout><Directories initialTab="categories" /></Layout></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><Layout><ReportsPage /></Layout></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Layout><Settings /></Layout></ProtectedRoute>} />
            <Route path="/" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    )
}

const App: React.FC = () => {
  return (
    <AuthProvider>
        <FinanceProvider>
        <HashRouter>
            <AppRoutes />
        </HashRouter>
        </FinanceProvider>
    </AuthProvider>
  );
};

export default App;