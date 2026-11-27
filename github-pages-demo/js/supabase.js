import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const SUPABASE_URL = 'https://wdwppfkwzmaadwygrthy.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_OMIwFk36OmadMSzqcbywiQ_2Ohj32AY';

export const isSupabaseConfigured =
    SUPABASE_URL !== 'PASTE_YOUR_SUPABASE_PROJECT_URL' &&
    SUPABASE_ANON_KEY !== 'PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY';

export const supabase = isSupabaseConfigured
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
        }
    })
    : null;
