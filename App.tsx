import React, { useState, useRef, useCallback } from 'react';
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
import { Plus, LogOut } from 'lucide-react';
import { formatCurrency } from './utils/format';

const TopBar: React.FC = () => {
  const { getTotalBalance } = useFinance();
  const { user, logout } = useAuth();
  const balance = getTotalBalance();
  
  return (
    <div className="h-14 bg-white border-b border-slate-200 shadow-sm text-slate-800 flex items-center justify-between px-4 lg:px-6 fixed top-0 right-0 left-16 z-20">
       <div className="flex items-center gap-4">
       </div>
       <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
             <span className="text-xs text-slate-500 whitespace-nowrap">На счетах</span>
             <span className={`text-sm font-bold whitespace-nowrap ${balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(balance)}</span>
          </div>
          <div className="h-6 w-px bg-slate-200"></div>
          <div className="flex items-center gap-2">
             <div className="w-7 h-7 rounded-full bg-teal-50 flex items-center justify-center text-teal-600 font-bold text-xs">
               {user?.username?.[0]?.toUpperCase() || '?'}
             </div>
             <span className="text-xs font-medium text-slate-600">{user?.username}</span>
             <button onClick={logout} className="text-slate-400 hover:text-rose-500 ml-1" title="Выйти">
                <LogOut size={15} />
             </button>
          </div>
       </div>
    </div>
  )
}

const Layout: React.FC<{ children: React.ReactNode; sidebarExpanded: boolean; onSidebarEnter: () => void; onSidebarLeave: () => void }> = ({ children, sidebarExpanded, onSidebarEnter, onSidebarLeave }) => {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar expanded={sidebarExpanded} onMouseEnter={onSidebarEnter} onMouseLeave={onSidebarLeave} />
      <TopBar />
      <main className="flex-1 ml-16 mt-14 p-0">
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
    const [sidebarExpanded, setSidebarExpanded] = useState(false);
    const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleSidebarEnter = useCallback(() => {
      if (collapseTimer.current) {
        clearTimeout(collapseTimer.current);
        collapseTimer.current = null;
      }
      setSidebarExpanded(true);
    }, []);

    const handleSidebarLeave = useCallback(() => {
      collapseTimer.current = setTimeout(() => {
        setSidebarExpanded(false);
      }, 300);
    }, []);

    const withLayout = (child: React.ReactNode) => (
      <Layout sidebarExpanded={sidebarExpanded} onSidebarEnter={handleSidebarEnter} onSidebarLeave={handleSidebarLeave}>
        {child}
      </Layout>
    );

    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/transactions" element={<ProtectedRoute>{withLayout(<TransactionList />)}</ProtectedRoute>} />
            <Route path="/directories" element={<ProtectedRoute>{withLayout(<Directories initialTab="categories" />)}</ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute>{withLayout(<ReportsPage />)}</ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute>{withLayout(<Settings />)}</ProtectedRoute>} />
            <Route path="/" element={<ProtectedRoute>{withLayout(<Dashboard />)}</ProtectedRoute>} />
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