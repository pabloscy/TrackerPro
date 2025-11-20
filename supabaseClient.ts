import { createClient } from '@supabase/supabase-js';

// Values provided in the prompt
const supabaseUrl = 'https://dznpxijknjtldgecsbka.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6bnB4aWprbmp0bGRnZWNzYmthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzODk5ODUsImV4cCI6MjA3ODk2NTk4NX0.SyYfQvxupg4z9iybIf4n7-eqttnHbFFEobFEnyFTfbA';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);