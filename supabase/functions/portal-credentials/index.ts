import { createClient } from 'npm:@supabase/supabase-js@2'
import bcrypt from 'npm:bcryptjs@2.4.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const token = authHeader.replace('Bearer ', '')
  const { data: claims, error: authErr } = await supabase.auth.getClaims(token)
  if (authErr || !claims?.claims) return json({ error: 'Unauthorized' }, 401)
  const userId = claims.claims.sub as string

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Check role
  const { data: roles } = await admin.from('user_roles').select('role').eq('user_id', userId)
  const allowed = (roles ?? []).some((r: any) => r.role === 'admin' || r.role === 'financeiro')
  if (!allowed) return json({ error: 'Forbidden' }, 403)

  let body: { action: string; client_id?: string; email?: string; password?: string; is_active?: boolean }
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }

  if (body.action === 'upsert') {
    if (!body.client_id || !body.email || !body.password) return json({ error: 'client_id, email e senha obrigatórios' }, 400)
    if (body.password.length < 8) return json({ error: 'Senha deve ter pelo menos 8 caracteres' }, 400)
    const email = body.email.trim().toLowerCase()
    const hash = await bcrypt.hash(body.password, 10)

    const { data: existing } = await admin
      .from('portal_credentials')
      .select('id')
      .eq('client_id', body.client_id)
      .maybeSingle()

    let credId: string
    if (existing) {
      const { error } = await admin
        .from('portal_credentials')
        .update({ email, password_hash: hash, is_active: true })
        .eq('id', existing.id)
      if (error) return json({ error: error.message }, 400)
      credId = existing.id
    } else {
      const { data: created, error } = await admin
        .from('portal_credentials')
        .insert({ client_id: body.client_id, email, password_hash: hash, created_by: userId })
        .select('id')
        .single()
      if (error || !created) return json({ error: error?.message ?? 'Falha ao criar' }, 400)
      credId = created.id
    }

    await admin.from('clients').update({ portal_user_id: credId, portal_access_enabled: true }).eq('id', body.client_id)
    await admin.from('audit_logs').insert({
      action: existing ? 'portal_credential_updated' : 'portal_credential_created',
      table_name: 'portal_credentials',
      record_id: credId,
      user_id: userId,
      new_value: { client_id: body.client_id, email },
    })
    return json({ ok: true, credential_id: credId })
  }

  if (body.action === 'toggle_active') {
    if (!body.client_id || typeof body.is_active !== 'boolean') return json({ error: 'parametros inválidos' }, 400)
    await admin.from('clients').update({ portal_access_enabled: body.is_active }).eq('id', body.client_id)
    await admin.from('audit_logs').insert({
      action: 'portal_access_toggled',
      table_name: 'clients',
      record_id: body.client_id,
      user_id: userId,
      new_value: { portal_access_enabled: body.is_active },
    })
    // also kill open sessions if disabled
    if (!body.is_active) await admin.from('portal_sessions').delete().eq('client_id', body.client_id)
    return json({ ok: true })
  }

  if (body.action === 'status') {
    if (!body.client_id) return json({ error: 'client_id obrigatório' }, 400)
    const { data: cred } = await admin
      .from('portal_credentials')
      .select('id, email, is_active, last_login_at, created_at')
      .eq('client_id', body.client_id)
      .maybeSingle()
    const { data: client } = await admin.from('clients').select('portal_access_enabled').eq('id', body.client_id).single()
    return json({ credential: cred, portal_access_enabled: client?.portal_access_enabled ?? false })
  }

  return json({ error: 'Ação inválida' }, 400)
})