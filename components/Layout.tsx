import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogOut, LayoutDashboard, PlusCircle, List, Settings, Truck } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 font-sans selection:bg-blue-500 selection:text-white pb-24 md:pb-0 flex flex-col">
      
      {/* Desktop Header */}
      <header className="hidden md:flex justify-between items-center p-6 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-8">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
                <div className="bg-gradient-to-tr from-blue-500 to-purple-600 p-2 rounded-xl shadow-lg shadow-blue-500/20">
                    <Truck className="text-white w-6 h-6" />
                </div>
                <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                    TruckerPro UK
                </h1>
            </div>

            {/* Desktop Navigation Links */}
            {user && (
                <nav className="flex items-center gap-1 bg-slate-800/50 p-1 rounded-xl border border-white/5">
                    <button 
                        onClick={() => navigate('/')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition ${isActive('/') ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                    >
                        Dashboard
                    </button>
                    <button 
                        onClick={() => navigate('/history')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition ${isActive('/history') ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                    >
                        Historia
                    </button>
                    <button 
                        onClick={() => navigate('/add-shift')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition ${isActive('/add-shift') ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:text-white'}`}
                    >
                        + Dodaj Trasę
                    </button>
                </nav>
            )}
        </div>

        {user && (
            <div className="flex items-center gap-4">
                <button onClick={() => navigate('/settings')} className="p-2 hover:bg-white/5 rounded-full transition group">
                    <Settings className="w-5 h-5 text-slate-400 group-hover:text-blue-400 transition" />
                </button>
                <div className="h-6 w-[1px] bg-slate-700"></div>
                <button onClick={handleSignOut} className="flex items-center gap-2 text-sm text-slate-400 hover:text-red-400 font-medium transition">
                    <LogOut className="w-4 h-4" />
                    <span className="hidden lg:inline">Wyloguj</span>
                </button>
            </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-6">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      {user && (
        <nav className="md:hidden fixed bottom-4 left-4 right-4 h-16 bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex items-center justify-around z-50">
          <button 
            onClick={() => navigate('/')} 
            className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all duration-300 ${isActive('/') ? 'bg-blue-500/20 text-blue-400' : 'text-slate-400'}`}
          >
            <LayoutDashboard className="w-6 h-6" />
          </button>
          
          <button 
            onClick={() => navigate('/add-shift')} 
            className="flex flex-col items-center justify-center -mt-8 bg-gradient-to-tr from-blue-500 to-purple-600 w-14 h-14 rounded-full shadow-lg shadow-blue-500/40 text-white transform transition active:scale-95 hover:scale-105"
          >
            <PlusCircle className="w-8 h-8" />
          </button>
          
          <button 
            onClick={() => navigate('/history')} 
            className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all duration-300 ${isActive('/history') ? 'bg-purple-500/20 text-purple-400' : 'text-slate-400'}`}
          >
            <List className="w-6 h-6" />
          </button>
        </nav>
      )}
    </div>
  );
};