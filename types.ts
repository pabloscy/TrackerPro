export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  default_truck_reg: string | null;
}

export interface UserSettings {
  user_id: string;
  payment_type: 'hourly' | 'daily';
  hourly_rate_weekday: number;
  hourly_rate_saturday: number;
  hourly_rate_sunday: number;
  daily_rate_weekday: number;
  daily_rate_saturday: number;
  daily_rate_sunday: number;
  is_guaranteed_day: boolean;
  min_hours_guaranteed: number;
  overtime_start_hours: number; 
  overtime_rate_multiplier: number;
  period_type: 'weekly' | 'biweekly';
  period_start_day: number; // 1 = Monday
  period_cycle_ref_date?: string; // YYYY-MM-DD reference for bi-weekly start
}

export interface Stop {
  id?: string;
  route_id?: string;
  store_number: string;
  location_name: string;
  cages_delivered: number;
  cages_returned: number;
  sequence_order: number;
}

export interface Route {
  id?: string;
  shift_id?: string;
  sequence_order: number;
  stops: Stop[];
}

export interface Shift {
  id?: string;
  user_id: string;
  date: string; 
  start_time: string; 
  end_time: string; 
  start_km: number;
  end_km: number;
  truck_reg: string;
  trailer_id: string;
  refuel: boolean;
  notes: string;
  routes: Route[];
  total_hours?: number;
  estimated_earnings?: number;
}

export interface PeriodSettlement {
  id?: string;
  user_id: string;
  start_date: string;
  end_date: string;
  actual_amount: number;
  note: string;
}

export const DEFAULT_SETTINGS: UserSettings = {
  user_id: '',
  payment_type: 'hourly',
  hourly_rate_weekday: 18.50,
  hourly_rate_saturday: 22.00,
  hourly_rate_sunday: 24.00,
  daily_rate_weekday: 160,
  daily_rate_saturday: 180,
  daily_rate_sunday: 200,
  is_guaranteed_day: true,
  min_hours_guaranteed: 8,
  overtime_start_hours: 10,
  overtime_rate_multiplier: 1.5,
  period_type: 'weekly',
  period_start_day: 1, 
};