import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { supabase } from '../supabaseClient';
import { Save, CreditCard, Clock, CalendarRange } from 'lucide-react';
import { DEFAULT_SETTINGS } from '../types';

export const Settings: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const { register, handleSubmit, reset, watch } = useForm({
        defaultValues: DEFAULT_SETTINGS
    });

    const paymentType = watch('payment_type');
    const periodType = watch('period_type');

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data, error } = await supabase.from('settings').select('*').eq('user_id', user.id).maybeSingle();
            if (data) {
                reset(data);
            } else if (error) {
                console.error("Error fetching settings:", JSON.stringify(error, null, 2));
            }
        }
    };

    const onSubmit = async (data: any) => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Brak zalogowanego użytkownika");

            const { data: profile } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle();
            
            if (!profile) {
                await supabase.from('profiles').insert({
                    id: user.id,
                    email: user.email,
                    full_name: user.user_metadata?.full_name || '',
                });
            }

            const settingsToSave = {
                user_id: user.id,
                payment_type: data.payment_type,
                hourly_rate_weekday: Number(data.hourly_rate_weekday) || 0,
                hourly_rate_saturday: Number(data.hourly_rate_saturday) || 0,
                hourly_rate_sunday: Number(data.hourly_rate_sunday) || 0,
                daily_rate_weekday: Number(data.daily_rate_weekday) || 0,
                daily_rate_saturday: Number(data.daily_rate_saturday) || 0,
                daily_rate_sunday: Number(data.daily_rate_sunday) || 0,
                is_guaranteed_day: Boolean(data.is_guaranteed_day),
                min_hours_guaranteed: Number(data.min_hours_guaranteed) || 0,
                overtime_start_hours: Number(data.overtime_start_hours) || 0,
                overtime_rate_multiplier: Number(data.overtime_rate_multiplier) || 0,
                period_type: data.period_type,
                period_start_day: Number(data.period_start_day),
                period_cycle_ref_date: data.period_cycle_ref_date || null
            };

            const { error } = await supabase.from('settings').upsert(
                settingsToSave,
                { onConflict: 'user_id' }
            );
            
            if (error) throw error;
            alert('Zapisano ustawienia!');
        } catch (error: any) {
            console.error("Error saving settings:", JSON.stringify(error, null, 2));
            alert(`Błąd zapisu: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="pb-10">
            <h2 className="text-2xl font-bold text-white mb-6">Ustawienia</h2>
            
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                
                {/* Payment Type */}
                <div className="bg-slate-800/40 border border-white/5 p-6 rounded-2xl">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="bg-blue-500/20 p-2 rounded-lg">
                            <CreditCard className="w-5 h-5 text-blue-400" />
                        </div>
                        <h3 className="text-lg font-medium text-white">Typ Rozliczenia</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <label className={`cursor-pointer border rounded-xl p-4 flex flex-col items-center transition ${paymentType === 'hourly' ? 'bg-blue-600/20 border-blue-500' : 'bg-slate-900 border-slate-700 hover:border-slate-500'}`}>
                            <input type="radio" value="hourly" {...register('payment_type')} className="hidden" />
                            <span className="font-bold text-white">Na Godziny</span>
                            <span className="text-xs text-slate-400 mt-1">Płatne za każdą h</span>
                        </label>
                        <label className={`cursor-pointer border rounded-xl p-4 flex flex-col items-center transition ${paymentType === 'daily' ? 'bg-blue-600/20 border-blue-500' : 'bg-slate-900 border-slate-700 hover:border-slate-500'}`}>
                            <input type="radio" value="daily" {...register('payment_type')} className="hidden" />
                            <span className="font-bold text-white">Dniówka</span>
                            <span className="text-xs text-slate-400 mt-1">Stała stawka za dzień</span>
                        </label>
                    </div>
                </div>

                {/* Period Configuration */}
                <div className="bg-slate-800/40 border border-white/5 p-6 rounded-2xl">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="bg-emerald-500/20 p-2 rounded-lg">
                            <CalendarRange className="w-5 h-5 text-emerald-400" />
                        </div>
                        <h3 className="text-lg font-medium text-white">Okres Rozliczeniowy</h3>
                    </div>
                    
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <label className={`cursor-pointer border rounded-xl p-4 flex flex-col items-center transition ${periodType === 'weekly' ? 'bg-emerald-600/20 border-emerald-500' : 'bg-slate-900 border-slate-700 hover:border-slate-500'}`}>
                                <input type="radio" value="weekly" {...register('period_type')} className="hidden" />
                                <span className="font-bold text-white">Tygodniowy</span>
                            </label>
                            <label className={`cursor-pointer border rounded-xl p-4 flex flex-col items-center transition ${periodType === 'biweekly' ? 'bg-emerald-600/20 border-emerald-500' : 'bg-slate-900 border-slate-700 hover:border-slate-500'}`}>
                                <input type="radio" value="biweekly" {...register('period_type')} className="hidden" />
                                <span className="font-bold text-white">Dwutygodniowy</span>
                            </label>
                        </div>

                        {periodType === 'biweekly' && (
                            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                                <label className="text-xs text-slate-400 mb-2 block">Data początku cyklu (np. pierwszy poniedziałek roku)</label>
                                <input 
                                    type="date" 
                                    {...register('period_cycle_ref_date')}
                                    className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white"
                                />
                                <p className="text-[10px] text-slate-500 mt-2">Ta data służy jako punkt odniesienia do obliczania kolejnych okresów.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Rates */}
                <div className="bg-slate-800/40 border border-white/5 p-6 rounded-2xl">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="bg-purple-500/20 p-2 rounded-lg">
                            <Clock className="w-5 h-5 text-purple-400" />
                        </div>
                        <h3 className="text-lg font-medium text-white">Stawki {paymentType === 'hourly' ? '(£/h)' : '(£/dzień)'}</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">Pon - Pt</label>
                            <div className="relative">
                                <span className="absolute left-3 top-3 text-slate-500">£</span>
                                <input 
                                    type="number" step="0.01"
                                    {...register(paymentType === 'hourly' ? 'hourly_rate_weekday' : 'daily_rate_weekday', { valueAsNumber: true })}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 pl-7 text-white"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">Sobota</label>
                            <div className="relative">
                                <span className="absolute left-3 top-3 text-slate-500">£</span>
                                <input 
                                    type="number" step="0.01"
                                    {...register(paymentType === 'hourly' ? 'hourly_rate_saturday' : 'daily_rate_saturday', { valueAsNumber: true })}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 pl-7 text-white"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">Niedziela</label>
                            <div className="relative">
                                <span className="absolute left-3 top-3 text-slate-500">£</span>
                                <input 
                                    type="number" step="0.01"
                                    {...register(paymentType === 'hourly' ? 'hourly_rate_sunday' : 'daily_rate_sunday', { valueAsNumber: true })}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 pl-7 text-white"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Overtime */}
                <div className="bg-slate-800/40 border border-white/5 p-6 rounded-2xl">
                     <h3 className="text-lg font-medium text-white mb-4">Nadgodziny (Overtime)</h3>
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">Próg OT (godziny)</label>
                            <input 
                                type="number" step="0.5"
                                {...register('overtime_start_hours', { valueAsNumber: true })}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">Mnożnik stawki (np. 1.5)</label>
                            <input 
                                type="number" step="0.1"
                                {...register('overtime_rate_multiplier', { valueAsNumber: true })}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white"
                            />
                        </div>
                     </div>
                </div>

                <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-xl font-bold shadow-lg hover:shadow-blue-500/20 transition flex items-center justify-center gap-2"
                >
                    <Save className="w-5 h-5" /> {loading ? 'Zapisywanie...' : 'Zapisz Ustawienia'}
                </button>
            </form>
        </div>
    );
};