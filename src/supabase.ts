// @ts-ignore
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://zepohcstpequswlsimcr.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplcG9oY3N0cGVxdXN3bHNpbWNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0MTcwNzcsImV4cCI6MjEwMDk5MzA3N30.ZNfePl5N2aA3Zg3RySF7UInKWHVBCUqmYNxdAE5ZX_4'

export const supabase = createClient(supabaseUrl, supabaseKey)