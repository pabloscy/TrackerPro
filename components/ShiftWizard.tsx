import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { supabase } from '../supabaseClient';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Save, Plus, Trash2, Truck, ChevronLeft, ChevronRight, Edit3 } from 'lucide-react';
import canvasConfetti from 'canvas-confetti';

export const ShiftWizard: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams(); // Get shift ID if editing
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [truckSuggestions, setTruckSuggestions] = useState<string[]>([]);
  const [trailerSuggestions, setTrailerSuggestions] = useState<string[]>([]);

  const isEditMode = Boolean(id);

  const { register, control, handleSubmit, setValue, reset } = useForm({
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      start_time: '04:00',
      end_time: '14:00',
      start_km: 0,
      end_km: 0,
      refuel: false,
      truck_reg: '',
      trailer_id: '',
      notes: '',
      routes: [
        {
          sequence_order: 1,
          stops: [
            {
              store_number: '',
              location_name: '',
              cages_delivered: 0,
              cages_returned: 0,
              sequence_order: 1
            }
          ]
        }
      ]
    }
  });

  useEffect(() => {
    const loadData = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 1. Load suggestions (Trucks & Trailers)
        const { data: shiftsData } = await supabase
            .from('shifts')
            .select('truck_reg, trailer_id')
            .eq('user_id', user.id)
            .limit(100);
        
        if (shiftsData) {
            const uniqueTrucks = Array.from(new Set(shiftsData.map(s => s.truck_reg).filter(Boolean)));
            const uniqueTrailers = Array.from(new Set(shiftsData.map(s => s.trailer_id).filter(Boolean)));
            setTruckSuggestions(uniqueTrucks as string[]);
            setTrailerSuggestions(uniqueTrailers as string[]);
        }

        // 2. If Edit Mode, Load Existing Shift
        if (isEditMode && id) {
            const { data: shift, error } = await supabase
                .from('shifts')
                .select(`
                    *,
                    routes (
                        *,
                        stops (*)
                    )
                `)
                .eq('id', id)
                .eq('user_id', user.id) // Security check
                .single();

            if (shift) {
                // Format for react-hook-form
                const formattedData = {
                    date: shift.date,
                    start_time: shift.start_time,
                    end_time: shift.end_time,
                    start_km: shift.start_km,
                    end_km: shift.end_km,
                    refuel: shift.refuel,
                    truck_reg: shift.truck_reg,
                    trailer_id: shift.trailer_id,
                    notes: shift.notes,
                    routes: shift.routes.sort((a: any, b: any) => a.sequence_order - b.sequence_order).map((r: any) => ({
                        sequence_order: r.sequence_order,
                        stops: r.stops.sort((a: any, b: any) => a.sequence_order - b.sequence_order).map((s: any) => ({
                            store_number: s.store_number,
                            location_name: s.location_name,
                            cages_delivered: s.cages_delivered,
                            cages_returned: s.cages_returned,
                            sequence_order: s.sequence_order
                        }))
                    }))
                };
                reset(formattedData);
            } else if (error) {
                console.error("Error loading shift:", error);
                alert("Nie znaleziono trasy.");
                navigate('/');
            }
        } else {
            // 3. If New Mode, Load Defaults (Profile & Last Shift KM)
            const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
            if (profile && profile.default_truck_reg) setValue('truck_reg', profile.default_truck_reg);
            
            const { data: lastShift } = await supabase
                .from('shifts')
                .select('end_km')
                .eq('user_id', user.id)
                .order('date', { ascending: false })
                .limit(1)
                .maybeSingle();
                
            if (lastShift) {
                setValue('start_km', lastShift.end_km);
                setValue('end_km', lastShift.end_km); 
            }
        }
    };
    loadData();
  }, [setValue, isEditMode, id, reset, navigate]);

  const { fields: routeFields, append: appendRoute, remove: removeRoute } = useFieldArray({
    control,
    name: "routes"
  });

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const shiftPayload = {
          user_id: user.id,
          date: data.date,
          start_time: data.start_time,
          end_time: data.end_time,
          start_km: Number(data.start_km) || 0,
          end_km: Number(data.end_km) || 0,
          truck_reg: (data.truck_reg || '').toUpperCase(),
          trailer_id: data.trailer_id ? data.trailer_id.toUpperCase() : '',
          refuel: Boolean(data.refuel),
          notes: data.notes || ''
      };

      let shiftId = id;

      if (isEditMode && id) {
          // UPDATE Existing Shift
          const { error: updateError } = await supabase
            .from('shifts')
            .update(shiftPayload)
            .eq('id', id);

          if (updateError) throw updateError;

          // For simplicity in this app structure: Delete old routes/stops and re-insert
          // Cascading delete in DB handles stops if routes are deleted
          await supabase.from('routes').delete().eq('shift_id', id);

      } else {
          // INSERT New Shift
          const { data: shiftData, error: shiftError } = await supabase
            .from('shifts')
            .insert(shiftPayload)
            .select()
            .single();

          if (shiftError) throw shiftError;
          shiftId = shiftData.id;
      }

      // Insert Routes & Stops (Common Logic for Create & Update)
      if (data.routes && data.routes.length > 0 && shiftId) {
          for (const [rIndex, route] of data.routes.entries()) {
              const { data: routeData, error: routeError } = await supabase
                .from('routes')
                .insert({
                    shift_id: shiftId,
                    sequence_order: rIndex + 1
                })
                .select()
                .single();

              if (routeError) throw routeError;

              if (route.stops && route.stops.length > 0) {
                  const stopsToInsert = route.stops.map((stop: any, sIndex: number) => ({
                      route_id: routeData.id,
                      store_number: stop.store_number || '',
                      location_name: stop.location_name || '',
                      cages_delivered: Number(stop.cages_delivered) || 0,
                      cages_returned: Number(stop.cages_returned) || 0,
                      sequence_order: sIndex + 1
                  }));

                  const { error: stopError } = await supabase.from('stops').insert(stopsToInsert);
                  if (stopError) throw stopError;
              }
          }
      }

      if (!isEditMode) {
        canvasConfetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 }
        });
      }
      
      navigate('/history'); // Go to history after save

    } catch (error: any) {
      console.error('Error saving shift:', JSON.stringify(error, null, 2));
      const errorMsg = error?.message || error?.details || JSON.stringify(error);
      alert(`Błąd zapisu: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => setStep(s => Math.min(s + 1, 3));
  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  return (
    <div className="pb-10">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">
            {isEditMode ? 'Edytuj Dzień' : 'Nowy Dzień Pracy'}
        </h2>
        <div className="flex gap-2">
            {[1, 2, 3].map(i => (
                <div key={i} className={`h-2 w-8 rounded-full transition-colors ${step >= i ? 'bg-blue-500' : 'bg-slate-700'}`} />
            ))}
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        
        {/* STEP 1: Basic Info */}
        {step === 1 && (
          <motion.div 
            initial={{ opacity: 0, x: -20 }} 
            animate={{ opacity: 1, x: 0 }} 
            className="space-y-4"
          >
            <div className="bg-slate-800/50 p-4 rounded-xl border border-white/5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Data</label>
                        <input 
                            type="date" 
                            {...register('date', { required: true })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Start</label>
                        <input 
                            type="time" 
                            {...register('start_time')}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Koniec</label>
                        <input 
                            type="time" 
                            {...register('end_time')}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Licznik Start (km)</label>
                        <input 
                            type="number" 
                            {...register('start_km', { valueAsNumber: true })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Licznik Koniec (km)</label>
                        <input 
                            type="number" 
                            {...register('end_km', { valueAsNumber: true })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                    <input type="checkbox" {...register('refuel')} id="refuel" className="w-5 h-5 rounded border-slate-600 text-blue-600 focus:ring-blue-500 bg-slate-900" />
                    <label htmlFor="refuel" className="text-sm text-white">Tankowanie?</label>
                </div>
            </div>

            <div className="bg-slate-800/50 p-4 rounded-xl border border-white/5 space-y-4">
                <h3 className="text-sm font-semibold text-blue-400 flex items-center gap-2">
                    <Truck className="w-4 h-4" /> Pojazd
                </h3>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Nr Rej. Ciągnika</label>
                        <input 
                            type="text" 
                            list="trucks"
                            placeholder="SK17 ABC"
                            {...register('truck_reg', { required: true })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white uppercase"
                        />
                        <datalist id="trucks">
                            {truckSuggestions.map((t, i) => <option key={i} value={t} />)}
                        </datalist>
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">ID Naczepy</label>
                        <input 
                            type="text" 
                            list="trailers"
                            placeholder="FR12 345"
                            {...register('trailer_id')}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white uppercase"
                        />
                        <datalist id="trailers">
                            {trailerSuggestions.map((t, i) => <option key={i} value={t} />)}
                        </datalist>
                    </div>
                </div>
            </div>
          </motion.div>
        )}

        {/* STEP 2: Routes & Shops */}
        {step === 2 && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }} 
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            {routeFields.map((route, rIndex) => (
                <RouteItem 
                    key={route.id} 
                    rIndex={rIndex} 
                    control={control} 
                    register={register} 
                    removeRoute={removeRoute}
                    count={routeFields.length}
                />
            ))}

            <button 
                type="button"
                onClick={() => appendRoute({
                    sequence_order: routeFields.length + 1,
                    stops: [{ store_number: '', location_name: '', cages_delivered: 0, cages_returned: 0, sequence_order: 1 }]
                })}
                className="w-full py-3 border-2 border-dashed border-slate-600 rounded-xl text-slate-400 hover:border-blue-500 hover:text-blue-400 transition flex items-center justify-center gap-2"
            >
                <Plus className="w-5 h-5" />
                Dodaj kolejną trasę
            </button>
          </motion.div>
        )}

        {/* STEP 3: Summary & Notes */}
        {step === 3 && (
             <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }}
                className="space-y-4"
             >
                 <div className="bg-slate-800/50 p-4 rounded-xl border border-white/5">
                    <label className="block text-sm font-medium text-white mb-2">Notatki / Defekty</label>
                    <textarea 
                        {...register('notes')}
                        rows={4}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Opóźnienia, problemy na sklepie, uszkodzenia..."
                    ></textarea>
                 </div>
             </motion.div>
        )}

        {/* Navigation Buttons */}
        <div className="fixed bottom-20 left-0 right-0 px-4 max-w-5xl mx-auto flex gap-4 md:static md:mt-8 z-10">
            {step > 1 && (
                <button 
                    type="button" 
                    onClick={prevStep}
                    className="flex-1 bg-slate-800 text-white py-4 rounded-xl font-semibold shadow-lg active:scale-95 transition flex items-center justify-center gap-2"
                >
                    <ChevronLeft className="w-5 h-5" /> Wstecz
                </button>
            )}
            
            {step < 3 ? (
                <button 
                    type="button" 
                    onClick={nextStep}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 text-white py-4 rounded-xl font-semibold shadow-lg shadow-blue-500/30 active:scale-95 transition flex items-center justify-center gap-2"
                >
                    Dalej <ChevronRight className="w-5 h-5" />
                </button>
            ) : (
                <button 
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-4 rounded-xl font-semibold shadow-lg shadow-emerald-500/30 active:scale-95 transition flex items-center justify-center gap-2"
                >
                    {loading ? 'Zapisywanie...' : (
                        <>{isEditMode ? 'Zaktualizuj' : 'Zapisz'} <Save className="w-5 h-5" /></>
                    )}
                </button>
            )}
        </div>
      </form>
    </div>
  );
};

const RouteItem = ({ rIndex, control, register, removeRoute, count }: any) => {
    const { fields: stopFields, append: appendStop, remove: removeStop } = useFieldArray({
        control,
        name: `routes.${rIndex}.stops`
    });

    return (
        <div className="bg-slate-800/40 border border-white/10 rounded-xl p-4 space-y-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-500 to-purple-600"></div>
            <div className="flex justify-between items-center">
                <h4 className="text-white font-bold">Trasa #{rIndex + 1}</h4>
                {count > 1 && (
                    <button type="button" onClick={() => removeRoute(rIndex)} className="text-red-400 hover:text-red-300 p-2">
                        <Trash2 className="w-4 h-4" />
                    </button>
                )}
            </div>

            <div className="space-y-3 pl-2">
                {stopFields.map((stop: any, sIndex: number) => (
                    <div key={stop.id} className="flex gap-2 items-start bg-slate-900/50 p-3 rounded-lg border border-white/5">
                         <div className="grid grid-cols-12 gap-2 w-full">
                            <div className="col-span-3">
                                <input 
                                    placeholder="Nr"
                                    {...register(`routes.${rIndex}.stops.${sIndex}.store_number`, { required: true })}
                                    className="w-full bg-transparent border-b border-slate-700 text-white text-sm p-1 focus:border-blue-500 outline-none"
                                />
                            </div>
                            <div className="col-span-9">
                                <input 
                                    placeholder="Miasto / Sklep"
                                    {...register(`routes.${rIndex}.stops.${sIndex}.location_name`, { required: true })}
                                    className="w-full bg-transparent border-b border-slate-700 text-white text-sm p-1 focus:border-blue-500 outline-none"
                                />
                            </div>
                            <div className="col-span-6">
                                <label className="text-[10px] text-slate-500 block">Cages IN</label>
                                <input 
                                    type="number"
                                    {...register(`routes.${rIndex}.stops.${sIndex}.cages_delivered`, { valueAsNumber: true })}
                                    className="w-full bg-slate-800 rounded px-2 py-1 text-white text-sm"
                                />
                            </div>
                            <div className="col-span-6">
                                <label className="text-[10px] text-slate-500 block">Cages OUT</label>
                                <input 
                                    type="number"
                                    {...register(`routes.${rIndex}.stops.${sIndex}.cages_returned`, { valueAsNumber: true })}
                                    className="w-full bg-slate-800 rounded px-2 py-1 text-white text-sm"
                                />
                            </div>
                         </div>
                         {stopFields.length > 1 && (
                             <button type="button" onClick={() => removeStop(sIndex)} className="text-slate-500 hover:text-red-400 mt-2">
                                 <Trash2 className="w-4 h-4" />
                             </button>
                         )}
                    </div>
                ))}
                
                <button 
                    type="button"
                    onClick={() => appendStop({ store_number: '', location_name: '', cages_delivered: 0, cages_returned: 0 })}
                    className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1"
                >
                    <Plus className="w-3 h-3" /> Dodaj sklep
                </button>
            </div>
        </div>
    );
};