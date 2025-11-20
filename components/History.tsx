import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Shift, DEFAULT_SETTINGS, PeriodSettlement } from '../types';
import { calculateEarnings, formatCurrency, calculateDurationHours, getCurrentPeriodRange, getPreviousPeriodRange } from '../services/calculations';
import { ChevronDown, ChevronUp, Copy, Edit3, CheckCircle, Save, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

type FilterType = 'current' | 'previous' | 'all';

export const History: React.FC = () => {
  const navigate = useNavigate();
  const [shifts, setShifts] = useState<any[]>([]);
  const [filteredShifts, setFilteredShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [filter, setFilter] = useState<FilterType>('current');
  const [periodRange, setPeriodRange] = useState({ start: new Date(), end: new Date() });
  
  // Settlement State
  const [settlement, setSettlement] = useState<PeriodSettlement | null>(null);
  const [isEditingSettlement, setIsEditingSettlement] = useState(false);
  const [actualPayInput, setActualPayInput] = useState('');
  const [settlementNote, setSettlementNote] = useState('');

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    applyFilter();
  }, [shifts, filter, settings]);

  const loadHistory = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: settingsData } = await supabase.from('settings').select('*').eq('user_id', user.id).single();
    const userSettings = settingsData || DEFAULT_SETTINGS;
    setSettings(userSettings);

    const { data, error } = await supabase
      .from('shifts')
      .select(`*, routes (*, stops (*))`)
      .eq('user_id', user.id)
      .order('date', { ascending: false });

    if (data) {
        const calculated = data.map((s: any) => ({
            ...s,
            estimated_earnings: calculateEarnings(s, userSettings)
        }));
        setShifts(calculated);
    }
    setLoading(false);
  };

  const loadSettlement = async (start: Date, end: Date) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('period_settlements')
        .select('*')
        .eq('user_id', user.id)
        .eq('start_date', start.toISOString().split('T')[0])
        .eq('end_date', end.toISOString().split('T')[0])
        .maybeSingle();

      if (data) {
          setSettlement(data);
          setActualPayInput(data.actual_amount.toString());
          setSettlementNote(data.note || '');
      } else {
          setSettlement(null);
          setActualPayInput('');
          setSettlementNote('');
      }
  };

  const applyFilter = () => {
    let start: Date, end: Date;

    if (filter === 'current') {
        const range = getCurrentPeriodRange(settings);
        start = range.start;
        end = range.end;
    } else if (filter === 'previous') {
        const current = getCurrentPeriodRange(settings);
        const range = getPreviousPeriodRange(settings, current.start);
        start = range.start;
        end = range.end;
    } else {
        setFilteredShifts(shifts);
        setPeriodRange({ start: new Date(0), end: new Date() }); // All time
        setSettlement(null);
        return;
    }

    setPeriodRange({ start, end });
    loadSettlement(start, end);

    const filtered = shifts.filter(s => {
        const date = new Date(`${s.date}T00:00:00`);
        return date >= start && date <= end;
    });
    setFilteredShifts(filtered);
  };

  const saveSettlement = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const payload = {
          user_id: user.id,
          start_date: periodRange.start.toISOString().split('T')[0],
          end_date: periodRange.end.toISOString().split('T')[0],
          actual_amount: parseFloat(actualPayInput) || 0,
          note: settlementNote
      };

      // Delete existing to avoid conflict if unique constraint acts up, or use upsert with conflict on unique keys
      const { error } = await supabase.from('period_settlements').upsert(
          payload, 
          { onConflict: 'user_id,start_date,end_date' }
      );

      if (error) {
          alert('Błąd zapisu: ' + error.message);
      } else {
          loadSettlement(periodRange.start, periodRange.end);
          setIsEditingSettlement(false);
      }
  };

  // Generate clipboard report
  const generateReport = () => {
    if (filteredShifts.length === 0) {
        alert('Brak danych do raportu.');
        return;
    }
    const reportShifts = [...filteredShifts].reverse();
    const totalEarnings = reportShifts.reduce((acc, s) => acc + s.estimated_earnings, 0);
    const totalHours = reportShifts.reduce((acc, s) => acc + calculateDurationHours(s), 0);

    let text = `📋 RAPORT: ${periodRange.start.toLocaleDateString()} - ${periodRange.end.toLocaleDateString()}\n`;
    text += `💰 Estymacja: ${formatCurrency(totalEarnings)}\n`;
    if (settlement) text += `✅ Wypłacono: ${formatCurrency(settlement.actual_amount)}\n`;
    text += `⏱ Godziny: ${totalHours.toFixed(2)}h\n\n`;

    reportShifts.forEach(s => {
        const duration = calculateDurationHours(s);
        text += `${s.date} (${duration}h) - ${formatCurrency(s.estimated_earnings)}\n`;
    });

    if (navigator.clipboard) {
        navigator.clipboard.writeText(text);
        alert('Raport skopiowany!');
    }
  };

  if (loading) return <div className="text-center text-slate-400 mt-10 animate-pulse">Ładowanie...</div>;

  // Stats for view
  const totalEstimated = filteredShifts.reduce((acc, s) => acc + s.estimated_earnings, 0);

  return (
    <div className="space-y-6 pb-10">
      
      <div className="bg-slate-800/40 border border-white/5 p-4 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
            <h2 className="text-2xl font-bold text-white">Historia</h2>
            <p className="text-slate-400 text-sm">{periodRange.start.toLocaleDateString()} - {periodRange.end.toLocaleDateString()}</p>
        </div>
        <div className="flex bg-slate-900/50 p-1 rounded-lg border border-slate-700">
            <button onClick={() => setFilter('current')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${filter === 'current' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>Obecny</button>
            <button onClick={() => setFilter('previous')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${filter === 'previous' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>Poprzedni</button>
            <button onClick={() => setFilter('all')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${filter === 'all' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>Wszystkie</button>
        </div>
      </div>

      {/* SETTLEMENT / PAY ADJUSTMENT CARD */}
      {filter !== 'all' && (
          <div className="bg-gradient-to-r from-slate-800 to-slate-900 border border-white/10 p-5 rounded-xl">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Rozliczenie Okresu</div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-white">{formatCurrency(totalEstimated)}</span>
                        <span className="text-sm text-slate-500">Estymowane</span>
                    </div>
                </div>
                <button onClick={generateReport} className="text-emerald-400 hover:bg-emerald-400/10 p-2 rounded-lg transition">
                    <Copy className="w-5 h-5" />
                </button>
            </div>

            {/* Actual Pay Logic */}
            <div className="bg-black/20 rounded-lg p-4">
                {!isEditingSettlement && settlement ? (
                    <div className="flex justify-between items-center">
                        <div>
                            <div className="text-xs text-emerald-400 font-bold mb-1 flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" /> ZATWIERDZONE
                            </div>
                            <div className="text-xl font-bold text-white">{formatCurrency(settlement.actual_amount)}</div>
                            {settlement.note && <div className="text-xs text-slate-400 mt-1">"{settlement.note}"</div>}
                        </div>
                        <button onClick={() => setIsEditingSettlement(true)} className="text-sm text-blue-400 hover:underline">Edytuj</button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm text-slate-300">
                            <AlertCircle className="w-4 h-4 text-yellow-400" />
                            <span>Wprowadź faktyczną kwotę wypłaty (np. z paska):</span>
                        </div>
                        <div className="flex gap-2">
                            <input 
                                type="number" 
                                placeholder="Kwota np. 2150"
                                value={actualPayInput}
                                onChange={(e) => setActualPayInput(e.target.value)}
                                className="flex-1 bg-slate-900 border border-slate-600 rounded-lg p-2 text-white"
                            />
                            <button onClick={saveSettlement} className="bg-emerald-600 text-white px-4 rounded-lg font-medium hover:bg-emerald-500">
                                <Save className="w-5 h-5" />
                            </button>
                        </div>
                        <input 
                             type="text"
                             placeholder="Notatka (np. Bonus świąteczny)"
                             value={settlementNote}
                             onChange={(e) => setSettlementNote(e.target.value)}
                             className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white text-sm"
                        />
                        {isEditingSettlement && (
                            <button onClick={() => setIsEditingSettlement(false)} className="text-xs text-slate-500 hover:text-white mt-2">Anuluj</button>
                        )}
                    </div>
                )}
            </div>
          </div>
      )}

      <div className="space-y-3">
        {filteredShifts.length === 0 ? (
            <div className="text-center py-12 text-slate-500">Brak danych.</div>
        ) : (
            filteredShifts.map((shift) => (
            <motion.div 
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                key={shift.id} 
                className="bg-slate-800/40 border border-white/5 rounded-xl overflow-hidden"
            >
                <div 
                    onClick={() => setExpandedId(expandedId === shift.id ? null : shift.id)}
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-800/60 transition"
                >
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-900/30 p-2 rounded-lg text-blue-400 font-bold flex flex-col items-center w-14">
                            <span className="text-[10px] uppercase">{new Date(shift.date).toLocaleString('pl-PL', { weekday: 'short' })}</span>
                            <span className="text-lg">{new Date(shift.date).getDate()}</span>
                        </div>
                        <div>
                            <div className="text-white font-medium text-sm">
                                {shift.start_time} - {shift.end_time} <span className="text-slate-500">({calculateDurationHours(shift)}h)</span>
                            </div>
                            <div className="text-xs text-slate-400">
                                {(shift.end_km - shift.start_km)} km • {shift.truck_reg}
                            </div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="font-bold text-emerald-400 text-sm">{formatCurrency(shift.estimated_earnings)}</div>
                        {expandedId === shift.id ? <ChevronUp className="w-4 h-4 text-slate-500 ml-auto" /> : <ChevronDown className="w-4 h-4 text-slate-500 ml-auto" />}
                    </div>
                </div>

                <AnimatePresence>
                    {expandedId === shift.id && (
                        <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="bg-slate-900/50 border-t border-white/5"
                        >
                            <div className="p-4 relative">
                                <button 
                                    onClick={(e) => { e.stopPropagation(); navigate(`/edit-shift/${shift.id}`); }}
                                    className="absolute top-4 right-4 bg-blue-600 hover:bg-blue-500 text-white p-1.5 px-3 rounded-lg shadow text-xs font-bold flex items-center gap-1"
                                >
                                    <Edit3 className="w-3 h-3" /> Edytuj
                                </button>

                                <div className="space-y-3 text-sm pr-16">
                                    {shift.routes?.map((route: any, idx: number) => (
                                        <div key={route.id} className="relative pl-3 border-l-2 border-blue-500/30">
                                            <div className="text-slate-300 font-medium mb-1 text-xs">Trasa {idx + 1}</div>
                                            <ul className="space-y-1">
                                                {route.stops?.map((stop: any) => (
                                                    <li key={stop.id} className="flex justify-between text-slate-400 text-xs">
                                                        <span>{stop.location_name}</span>
                                                        <span className="bg-slate-800 px-1.5 py-0.5 rounded text-[10px]">{stop.cages_delivered} Cages</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    ))}
                                    {shift.notes && <div className="text-orange-300 text-xs italic border-t border-white/5 pt-2">{shift.notes}</div>}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
            ))
        )}
      </div>
    </div>
  );
};