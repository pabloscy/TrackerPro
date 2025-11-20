import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { Auth } from './components/Auth';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { ShiftWizard } from './components/ShiftWizard';
import { History } from './components/History';
import { Settings } from './components/Settings';

interface RequireAuthProps {
  children?: React.ReactNode;
}

const RequireAuth = ({ children }: RequireAuthProps) => {
    const [session, setSession] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        const checkSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                setSession(session);
            } catch (error) {
                console.error("Error checking session:", error);
            } finally {
                setLoading(false);
            }
        };

        checkSession();
        
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setLoading(false);
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0f172a] flex items-center justify-center text-white">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (!session) {
        return <Navigate to="/login" replace />;
    }

    return <>{children}</>;
};

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Auth />} />
        
        <Route path="/" element={
          <RequireAuth>
            <Layout>
              <Dashboard />
            </Layout>
          </RequireAuth>
        } />

        <Route path="/add-shift" element={
          <RequireAuth>
            <Layout>
              <ShiftWizard />
            </Layout>
          </RequireAuth>
        } />

        <Route path="/edit-shift/:id" element={
          <RequireAuth>
            <Layout>
              <ShiftWizard />
            </Layout>
          </RequireAuth>
        } />

        <Route path="/history" element={
          <RequireAuth>
            <Layout>
              <History />
            </Layout>
          </RequireAuth>
        } />
        
        <Route path="/settings" element={
          <RequireAuth>
            <Layout>
              <Settings />
            </Layout>
          </RequireAuth>
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

export default App;