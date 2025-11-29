import React, { useState, useEffect } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from 'react-router-dom';
import { LoginForm } from './components/auth/LoginForm';
import { RegisterForm } from './components/auth/RegisterForm';
import { Sidebar } from './components/layout/Sidebar';
import { MobileMenu } from './components/layout/MobileMenu';
import { Dashboard } from './components/dashboard/Dashboard';

import { FirebaseInvoiceList } from './components/invoices/FirebaseInvoiceList';
// import { EditableGSTFiling } from './components/invoices/EditableGSTFiling';
import { ProfileSettings } from './components/profile/ProfileSettings';
import { InventoryManager } from './components/inventory/InventoryManager';
import { SaleCheckout } from './components/sale/SaleCheckout';
import { User, DashboardStats } from './types';
import './index.css';
import { useAuth } from './context/AuthContext';
import { ChatButton, AIChat } from './components/AI';

const AuthLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <div>{children}</div>;
};

const DashboardLayout: React.FC<{ user: User; children: React.ReactNode; onLogout: () => void }> = ({ user, children, onLogout }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  
  const getActiveTab = () => {
    const path = location.pathname;
    if (path === '/dashboard') return 'dashboard';
    if (path === '/inventory') return 'inventory';
    if (path === '/sale') return 'sale';
    if (path === '/invoices') return 'invoices';
    // if (path === '/gst') return 'gst';
    if (path === '/ai-chat') return 'ai-chat';
    if (path === '/profile') return 'profile';
    return 'dashboard';
  };

  const handleTabChange = (tab: string) => {
    navigate(`/${tab}`);
  };

  return (
    <div className="flex min-h-screen bg-purple-50">
      <div className="hidden lg:block lg:w-64 lg:flex-shrink-0">
        <Sidebar
          activeTab={getActiveTab()}
          onTabChange={handleTabChange}
          onLogout={onLogout}
          user={user}
        />
      </div>
      <MobileMenu
        isOpen={isMobileMenuOpen}
        onToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      >
        <Sidebar
          activeTab={getActiveTab()}
          onTabChange={(tab) => {
            handleTabChange(tab);
            setIsMobileMenuOpen(false);
          }}
          onLogout={onLogout}
          user={user}
        />
      </MobileMenu>
      <main className="flex-1 min-w-0 overflow-auto">
        <div className="lg:hidden h-16"></div>
        <div className="w-full px-2 sm:px-4 lg:px-0">
          {children}
        </div>
      </main>
    </div>
  );
};

function App() {
  const { user, loading: authLoading, logout, updateUserProfile } = useAuth();

  const getDashboardStats = (): DashboardStats => {
    return {
      totalSales: 0,
      totalPurchases: 0,
      totalItems: 0,
      pendingInvoices: 0,
      monthlyRevenue: [0, 0, 0, 0, 0, 0],
      recentTransactions: []
    };
  };

  const handleLogout = () => {
    void logout();
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Preparing your workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <ChatButton />
      <Routes>
        <Route path="/login" element={
          user ? <Navigate to="/dashboard" replace /> : 
          <AuthLayout>
            <LoginForm />
          </AuthLayout>
        } />
        <Route path="/register" element={
          user ? <Navigate to="/dashboard" replace /> : 
          <AuthLayout>
            <RegisterForm />
          </AuthLayout>
        } />
        <Route path="/dashboard" element={
          !user ? <Navigate to="/login" replace /> :
          <DashboardLayout user={user} onLogout={handleLogout}>
            <Dashboard stats={getDashboardStats()} />
          </DashboardLayout>
        } />
        <Route path="/inventory" element={
          !user ? <Navigate to="/login" replace /> :
          <DashboardLayout user={user} onLogout={handleLogout}>
            <InventoryManager />
          </DashboardLayout>
        } />
        <Route path="/sale" element={
          !user ? <Navigate to="/login" replace /> :
          <DashboardLayout user={user} onLogout={handleLogout}>
            <SaleCheckout />
          </DashboardLayout>
        } />

        <Route path="/invoices" element={
          !user ? <Navigate to="/login" replace /> :
          <DashboardLayout user={user} onLogout={handleLogout}>
            <FirebaseInvoiceList />
          </DashboardLayout>
        } />



        {/* <Route path="/gst" element={
          !user ? <Navigate to="/login" replace /> :
          <DashboardLayout user={user} onLogout={handleLogout}>
            <EditableGSTFiling invoices={[]} onUpdateInvoice={() => {}} />
          </DashboardLayout>
        } /> */}
        <Route path="/ai-chat" element={
          !user ? <Navigate to="/login" replace /> :
          <DashboardLayout user={user} onLogout={handleLogout}>
            <AIChat />
          </DashboardLayout>
        } />
        <Route path="/profile" element={
          !user ? <Navigate to="/login" replace /> :
          <DashboardLayout user={user} onLogout={handleLogout}>
            <ProfileSettings
              user={user!}
              onUpdateUser={updateUserProfile}
            />
          </DashboardLayout>
        } />
        <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />
        <Route path="/" element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />
      </Routes>
    </Router>
  );
}

export default App;
