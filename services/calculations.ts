import { Shift, UserSettings } from '../types';

export const calculateDurationHours = (shift: Shift): number => {
  if (!shift.start_time || !shift.end_time || !shift.date) return 0;

  const start = new Date(`${shift.date}T${shift.start_time}`);
  let end = new Date(`${shift.date}T${shift.end_time}`);

  if (end < start) {
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  }

  const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
  return Math.round((durationMinutes / 60) * 100) / 100;
};

export const calculateEarnings = (shift: Shift, settings: UserSettings): number => {
  if (!shift.start_time || !shift.end_time || !shift.date) return 0;

  const durationHours = calculateDurationHours(shift);
  
  const dateObj = new Date(`${shift.date}T00:00:00`);
  const day = dateObj.getDay();
  const isSat = day === 6;
  const isSun = day === 0;

  let earnings = 0;

  if (settings.payment_type === 'daily') {
    let rate = settings.daily_rate_weekday;
    if (isSat) rate = settings.daily_rate_saturday;
    if (isSun) rate = settings.daily_rate_sunday;

    if (settings.is_guaranteed_day && durationHours < settings.min_hours_guaranteed) {
        earnings = rate;
    } else {
        earnings = rate;
        if (durationHours > settings.overtime_start_hours) {
             const otHours = durationHours - settings.overtime_start_hours;
             const otRate = settings.hourly_rate_weekday * settings.overtime_rate_multiplier;
             earnings += otHours * otRate;
        }
    }
  } else {
    let rate = settings.hourly_rate_weekday;
    if (isSat) rate = settings.hourly_rate_saturday;
    if (isSun) rate = settings.hourly_rate_sunday;

    earnings = durationHours * rate;

    if (durationHours > settings.overtime_start_hours) {
        const otHours = durationHours - settings.overtime_start_hours;
        const extraPayPerOtHour = (rate * settings.overtime_rate_multiplier) - rate;
        earnings += otHours * extraPayPerOtHour;
    }
    
    if (settings.is_guaranteed_day && durationHours < settings.min_hours_guaranteed) {
        const missingHours = settings.min_hours_guaranteed - durationHours;
        earnings += missingHours * rate;
    }
  }

  return Math.round(earnings * 100) / 100;
};

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
};

// Helper to find start of a standard week
const getMonday = (d: Date) => {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
  return new Date(d.setDate(diff));
};

// Helper to determine current period range
export const getCurrentPeriodRange = (settings: UserSettings) => {
    const now = new Date();
    now.setHours(0,0,0,0);

    if (settings.period_type === 'biweekly' && settings.period_cycle_ref_date) {
        const refDate = new Date(settings.period_cycle_ref_date);
        refDate.setHours(0,0,0,0);
        
        // Calculate days passed since reference
        const diffTime = Math.abs(now.getTime() - refDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        // 14 days in a cycle
        const cyclesPassed = Math.floor(diffDays / 14);
        
        // Start of current cycle
        const currentStart = new Date(refDate);
        currentStart.setDate(refDate.getDate() + (cyclesPassed * 14));
        
        // End of current cycle
        const currentEnd = new Date(currentStart);
        currentEnd.setDate(currentStart.getDate() + 13);
        currentEnd.setHours(23,59,59,999);

        return { start: currentStart, end: currentEnd };
    } else {
        // Default Weekly (Monday start)
        const start = getMonday(new Date(now));
        start.setHours(0,0,0,0);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23,59,59,999);
        return { start, end };
    }
};

export const getPreviousPeriodRange = (settings: UserSettings, currentStart: Date) => {
    const prevStart = new Date(currentStart);
    const prevEnd = new Date(currentStart);
    prevEnd.setDate(prevEnd.getDate() - 1);
    prevEnd.setHours(23,59,59,999);

    if (settings.period_type === 'biweekly') {
        prevStart.setDate(prevStart.getDate() - 14);
    } else {
        prevStart.setDate(prevStart.getDate() - 7);
    }
    prevStart.setHours(0,0,0,0);

    return { start: prevStart, end: prevEnd };
};
