import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { Truck, AlertCircle } from 'lucide-react';

export const Auth: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        alert('Sprawdź email, aby potwierdzić rejestrację!');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        navigate('/');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a] p-4 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/20 blur-[100px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-600/20 blur-[100px]"></div>

      <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-3xl w-full max-w-md shadow-2xl">
        <div className="flex flex-col items-center mb-8">
            <div className="bg-gradient-to-tr from-blue-500 to-purple-600 p-4 rounded-2xl shadow-lg shadow-blue-500/30 mb-4">
                <Truck className="text-white w-8 h-8" />
            </div>
            <h1 className="text-3xl font-bold text-white">TruckerPro UK</h1>
            <p className="text-slate-400 mt-2 text-center">Twoje centrum dowodzenia w trasie</p>
        </div>

        {error && (
            <div className="bg-red-500/20 border border-red-500/50 text-red-200 p-3 rounded-lg mb-6 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> {error}
            </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="text-sm text-slate-300 ml-1">Email</label>
            <input
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition mt-1"
              type="email"
              placeholder="driver@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
             <label className="text-sm text-slate-300 ml-1">Hasło</label>
            <input
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition mt-1"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-500/25 transition transform active:scale-95"
            disabled={loading}
          >
            {loading ? 'Przetwarzanie...' : isSignUp ? 'Zarejestruj się' : 'Zaloguj się'}
          </button>
        </form>

        <div className="mt-6 text-center">
            <p className="text-slate-400 text-sm">
                {isSignUp ? "Masz już konto?" : "Nie masz konta?"}{" "}
                <button 
                    onClick={() => setIsSignUp(!isSignUp)} 
                    className="text-blue-400 hover:text-blue-300 font-medium"
                >
                    {isSignUp ? "Zaloguj się" : "Załóż konto"}
                </button>
            </p>
        </div>
      </div>
    </div>
  );
};