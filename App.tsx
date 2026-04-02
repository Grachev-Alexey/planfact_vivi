import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { FinanceProvider, useFinance } from './context/FinanceContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { TransactionList } from './components/TransactionList';
import { Directories } from './components/Directories';
import { Settings } from './components/Settings';
import { LoginPage } from './components/LoginPage';
import { ReportsPage } from './components/ReportsPage';
import { PaymentRequestPage } from './components/PaymentRequestPage';
import { MasterIncomePage } from './components/MasterIncomePage';
import { AdminStats } from './components/AdminStats';
import { PaymentCalendar } from './components/PaymentCalendar';
import { LogOut } from 'lucide-react';
import { formatCurrency } from './utils/format';

const TopBar: React.FC = () => {
  const { getTotalBalance } = useFinance();
  const { user, logout } = useAuth();
  const balance = getTotalBalance();
  
  return (
    <div className="h-14 bg-white border-b border-slate-200 shadow-sm text-slate-800 flex items-center justify-between px-4 lg:px-6 fixed top-0 right-0 left-0 md:left-[72px] z-20">
       <div className="flex items-center gap-4 pl-10 md:pl-0">
       </div>
       <div className="flex items-center gap-3 sm:gap-5">
          <div className="flex items-center gap-1 sm:gap-2">
             <span className="text-[10px] sm:text-xs text-slate-500 whitespace-nowrap">На счетах</span>
             <span className={`text-xs sm:text-sm font-bold whitespace-nowrap ${balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(balance)}</span>
          </div>
          <div className="h-6 w-px bg-slate-200"></div>
          <div className="flex items-center gap-2">
             <div className="w-7 h-7 rounded-full bg-teal-50 flex items-center justify-center text-teal-600 font-bold text-xs">
               {user?.username?.[0]?.toUpperCase() || '?'}
             </div>
             <span className="text-xs font-medium text-slate-600 hidden sm:inline">{user?.username}</span>
             <button onClick={logout} className="text-slate-400 hover:text-rose-500 ml-1" title="Выйти">
                <LogOut size={15} />
             </button>
          </div>
       </div>
    </div>
  )
}

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="flex min-h-screen bg-slate-50 overflow-hidden">
      <Sidebar />
      <TopBar />
      <main className="flex-1 min-w-0 ml-0 md:ml-[72px] mt-14 p-0 overflow-hidden">
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

const AdminRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role === 'requester') return <Navigate to="/payment-requests" replace />;
  if (user?.role === 'master') return <Navigate to="/master" replace />;
  return children;
};

const AppRoutes = () => {
    const { user } = useAuth();
    const isRequester = user?.role === 'requester';
    const isMaster = user?.role === 'master';
    const isPayoutController = user?.role === 'payout_controller';

    const withLayout = (child: React.ReactNode) => (
      <Layout>
        {child}
      </Layout>
    );

    if (isPayoutController) {
      return (
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/payment-requests" element={<ProtectedRoute>{withLayout(<PaymentRequestPage isAdmin />)}</ProtectedRoute>} />
          <Route path="/master-stats" element={<ProtectedRoute>{withLayout(<AdminStats />)}</ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/payment-requests" replace />} />
        </Routes>
      );
    }

    if (isMaster) {
      return (
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/master" element={<ProtectedRoute><MasterIncomePage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/master" replace />} />
        </Routes>
      );
    }

    if (isRequester) {
      return (
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/payment-requests" element={<ProtectedRoute>{withLayout(<PaymentRequestPage />)}</ProtectedRoute>} />
          <Route path="/master-stats" element={<ProtectedRoute>{withLayout(<AdminStats />)}</ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/payment-requests" replace />} />
        </Routes>
      );
    }

    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/transactions" element={<AdminRoute>{withLayout(<TransactionList />)}</AdminRoute>} />
            <Route path="/directories" element={<AdminRoute>{withLayout(<Directories initialTab="categories" />)}</AdminRoute>} />
            <Route path="/reports" element={<AdminRoute>{withLayout(<ReportsPage />)}</AdminRoute>} />
            <Route path="/settings" element={<AdminRoute>{withLayout(<Settings />)}</AdminRoute>} />
            <Route path="/payment-requests" element={<AdminRoute>{withLayout(<PaymentRequestPage isAdmin />)}</AdminRoute>} />
            <Route path="/master-stats" element={<AdminRoute>{withLayout(<AdminStats />)}</AdminRoute>} />
            <Route path="/payment-calendar" element={<AdminRoute>{withLayout(<PaymentCalendar />)}</AdminRoute>} />
            <Route path="/" element={<AdminRoute>{withLayout(<Dashboard />)}</AdminRoute>} />
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
