import { createClient } from '@supabase/supabase-js'

const projectUrl =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://ymmkodlifpxutynpjnxm.supabase.co'
const publishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  'sb_publishable_YK7q6HJhUO1z18lwAVbi9w_tOBG2pee'

export const supabase = createClient(projectUrl, publishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
