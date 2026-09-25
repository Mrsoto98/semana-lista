import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = 'https://nqusbtmgctafpnztrxgn.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xdXNidG1nY3RhZnBuenRyeGduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5Mjk3OTcsImV4cCI6MjEwNTUwNTc5N30.jaHp37AJlGIrWchwt68i34G3p2k0trBz0TE1UUh9cB4'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: { flowType: 'implicit' },
})

export async function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  })
}
