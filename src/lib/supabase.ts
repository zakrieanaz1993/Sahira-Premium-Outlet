// @ts-nocheck
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Session key for reel social interactions (per-browser identifier)
export const getSessionKey = (() => {
  let key = '';
  return () => {
    if (key) return key;
    try {
      key = localStorage.getItem('sahira_session_key_v1');
      if (!key) {
        key = 'sk-' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
        localStorage.setItem('sahira_session_key_v1', key);
      }
    } catch (_) {
      key = 'sk-fallback-' + Date.now();
    }
    return key;
  };
})();
