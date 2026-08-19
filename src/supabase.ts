// @ts-ignore
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://zepohcstpequswlsimcr.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_bH4IfGKGEAWRmyIEWQa19g_c84_c...'

export const supabase = createClient(supabaseUrl, supabaseKey)