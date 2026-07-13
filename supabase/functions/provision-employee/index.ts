import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 1. Handle CORS Preflight for the browser
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 2. Grab the data sent from your React frontend
    const { email, password, companyId, role } = await req.json()

    // 3. Initialize the Supabase Admin Client
    // We use the SERVICE_ROLE_KEY here because normal users aren't allowed to create other users
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 4. Create the User in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Auto-confirm so they can log in immediately
    })

    if (authError) throw authError

    // 5. Add the User to your user_profiles table
    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .insert([
        {
          user_id: authData.user.id,
          company_id: companyId,
          role: role
        }
      ])

    if (profileError) throw profileError

    // 6. Return Success
    return new Response(
      JSON.stringify({ message: 'User created successfully', user: authData.user }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    // 7. Handle Errors
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})