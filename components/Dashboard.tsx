import React, { useEffect, useState } from 'react';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Shift, UserSettings, DEFAULT_SETTINGS } from '../types';
import { calculateEarnings, formatCurrency, calculateDurationHours, getCurrentPeriodRange, getPreviousPeriodRange } from '../services/calculations';
import { supabase } from '../supabaseClient';
import { ArrowUpRight, ArrowDownRight, Calendar, DollarSign, MapPin, Package, Plus, ChevronRight, TrendingUp, Truck } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  
  const [currentPeriodStats, setCurrentPeriodStats] = useState({ earnings: 0, routes: 0, stores: 0 });
  const [previousPeriodStats, setPreviousPeriodStats] = useState({ earnings: 0, routes: 0, stores: 0 });
  const [periodRange, setPeriodRange] = useState({ start: new Date(), end: new Date() });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Settings
      const { data: settingsData } = await supabase
        .from('settings')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      const userSettings = settingsData || DEFAULT_SETTINGS;
      setSettings(userSettings);

      // 2. Calculate Periods based on settings
      const currentRange = getCurrentPeriodRange(userSettings);
      const previousRange = getPreviousPeriodRange(userSettings, currentRange.start);
      setPeriodRange(currentRange);

      // 3. Fetch all shifts (optimized: could filter by date range in DB, but fetching 60 days is safe for client-side filter)
      const { data: shiftsData, error } = await supabase
        .from('shifts')
        .select(`
            *,
            routes (
                *,
                stops (*)
            )
        `)
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(60);

      if (shiftsData) {
        const processedShifts = shiftsData.map((s: any) => ({
            ...s,
            estimated_earnings: calculateEarnings(s, userSettings)
        }));
        setShifts(processedShifts);

        // 4. Calculate Stats
        const calcStats = (start: Date, end: Date) => {
            const periodShifts = processedShifts.filter(s => {
                const d = new Date(`${s.date}T00:00:00`);
                return d >= start && d <= end;
            });

            const earnings = periodShifts.reduce((acc, s) => acc + (s.estimated_earnings || 0), 0);
            const routes = periodShifts.reduce((acc, s) => acc + (s.routes?.length || 0), 0);
            const stores = periodShifts.reduce((acc, s) => {
                return acc + (s.routes?.reduce((rAcc: number, r: any) => rAcc + (r.stops?.length || 0), 0) || 0);
            }, 0);

            return { earnings, routes, stores };
        };

        setCurrentPeriodStats(calcStats(currentRange.start, currentRange.end));
        setPreviousPeriodStats(calcStats(previousRange.start, previousRange.end));
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Chart Data
  const chartData = [...shifts].reverse().slice(-10).map(s => ({
      date: s.date.slice(5),
      earnings: s.estimated_earnings
  }));

  // Comparison Logic
  const getPercentChange = (current: number, prev: number) => {
    if (prev === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - prev) / prev) * 100);
  };
  
  const earningsChange = getPercentChange(currentPeriodStats.earnings, previousPeriodStats.earnings);

  if (loading) {
      return <div className="text-white text-center mt-20 animate-pulse">Ładowanie danych...</div>;
  }

  return (
    <div className="space-y-6">
      
      <div className="flex justify-between items-end">
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
        >
            <h2 className="text-3xl font-bold text-white">Dashboard</h2>
            <p className="text-slate-400 text-sm mt-1">
                Okres: {periodRange.start.toLocaleDateString()} - {periodRange.end.toLocaleDateString()} 
                <span className="ml-2 px-2 py-0.5 bg-slate-800 rounded text-xs uppercase text-slate-500">
                    {settings.period_type === 'biweekly' ? '2 Tygodnie' : 'Tydzień'}
                </span>
            </p>
        </motion.div>
      </div>

      <motion.button
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onClick={() => navigate('/add-shift')}
        className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl shadow-lg shadow-blue-500/20 flex items-center justify-between group"
      >
          <div className="flex items-center gap-4">
              <div className="bg-white/20 p-2 rounded-xl">
                  <Plus className="w-6 h-6 text-white" />
              </div>
              <div className="text-left">
                  <div className="font-bold text-lg text-white">Dodaj Nowy Dzień</div>
                  <div className="text-blue-100 text-sm">Rejestruj trasę i zarobki</div>
              </div>
          </div>
          <ChevronRight className="w-5 h-5 text-white opacity-50 group-hover:opacity-100 transition" />
      </motion.button>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Earnings */}
        <motion.div 
             initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
             className="bg-slate-800/40 backdrop-blur-lg border border-blue-500/20 rounded-2xl p-5 relative overflow-hidden"
        >
             <div className="absolute -right-4 -top-4 opacity-5"><DollarSign className="w-24 h-24" /></div>
             <h3 className="text-slate-400 text-xs font-medium uppercase">Zarobione (Est.)</h3>
             <div className="text-2xl font-bold text-white mt-1">{formatCurrency(currentPeriodStats.earnings)}</div>
             <div className={`flex items-center gap-1 mt-2 text-xs ${earningsChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {earningsChange >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                <span>{Math.abs(earningsChange)}% vs poprz.</span>
             </div>
        </motion.div>

        {/* Routes Count */}
        <motion.div 
             initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
             className="bg-slate-800/40 backdrop-blur-lg border border-white/5 rounded-2xl p-5"
        >
             <div className="flex items-center gap-3 mb-2">
                 <div className="bg-purple-500/20 p-1.5 rounded-lg"><Truck className="w-4 h-4 text-purple-400" /></div>
                 <h3 className="text-slate-400 text-xs font-medium uppercase">Ilość Tras</h3>
             </div>
             <div className="text-2xl font-bold text-white">{currentPeriodStats.routes}</div>
             <div className="text-xs text-slate-500 mt-1">W bieżącym okresie</div>
        </motion.div>

        {/* Stores Count */}
        <motion.div 
             initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
             className="bg-slate-800/40 backdrop-blur-lg border border-white/5 rounded-2xl p-5"
        >
             <div className="flex items-center gap-3 mb-2">
                 <div className="bg-orange-500/20 p-1.5 rounded-lg"><MapPin className="w-4 h-4 text-orange-400" /></div>
                 <h3 className="text-slate-400 text-xs font-medium uppercase">Sklepy</h3>
             </div>
             <div className="text-2xl font-bold text-white">{currentPeriodStats.stores}</div>
             <div className="text-xs text-slate-500 mt-1">Dostarczone</div>
        </motion.div>

        {/* Avg Earnings Trend */}
        <motion.div 
             initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
             className="bg-slate-800/40 backdrop-blur-lg border border-white/5 rounded-2xl p-5"
        >
             <div className="flex items-center gap-3 mb-2">
                 <div className="bg-emerald-500/20 p-1.5 rounded-lg"><TrendingUp className="w-4 h-4 text-emerald-400" /></div>
                 <h3 className="text-slate-400 text-xs font-medium uppercase">Śr. na dzień</h3>
             </div>
             <div className="text-2xl font-bold text-white">
                {shifts.length > 0 ? formatCurrency(currentPeriodStats.earnings / (shifts.filter(s => {
                    const d = new Date(`${s.date}T00:00:00`);
                    return d >= periodRange.start && d <= periodRange.end;
                }).length || 1)) : '£0'}
             </div>
             <div className="text-xs text-slate-500 mt-1">Estymacja</div>
        </motion.div>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-6">Ostatnie 10 dni</h3>
            <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                        <defs>
                            <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#60a5fa" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false}/>
                        <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `£${val}`}/>
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                            itemStyle={{ color: '#60a5fa' }}
                            formatter={(value: number) => [`£${value}`, 'Zarobek']}
                        />
                        <Line 
                            type="monotone" dataKey="earnings" stroke="#60a5fa" strokeWidth={3} 
                            dot={{ r: 4, fill: '#1e293b', stroke: '#60a5fa', strokeWidth: 2 }}
                            activeDot={{ r: 6, fill: '#60a5fa' }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
      )}
    </div>
  );
};