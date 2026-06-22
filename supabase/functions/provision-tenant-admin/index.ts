import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 1. Handle CORS Preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 2. Extract the data sent from your React app
    const { email, password, companyId } = await req.json()

    // 3. Initialize Supabase Admin Client
    // CRITICAL: We use the SERVICE_ROLE_KEY here so it has God-level database access
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 4. Create the User quietly in the background
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true 
    })

    if (authError) throw authError

    // 5. Link the new user to their Company as an Admin
    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .insert([{
        user_id: authData.user.id,
        company_id: companyId,
        role: 'admin'
      }])

    if (profileError) throw profileError

    // 6. Report Success back to React
    return new Response(
      JSON.stringify({ message: "Tenant admin successfully provisioned." }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})