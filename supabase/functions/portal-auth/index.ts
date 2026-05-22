import { createClient } from 'npm:@supabase/supabase-js@2'
import bcrypt from 'npm:bcryptjs@2.4.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function clientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('cf-connecting-ip') ||
    'unknown'
  )
}

async function audit(action: string, clientId: string | null, ip: string, extra: Record<string, unknown> = {}) {
  await admin.from('audit_logs').insert({
    action,
    table_name: 'portal_auth',
    record_id: clientId,
    ip_address: ip,
    new_value: extra,
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  let payload: { email?: string; password?: string; token?: string; action?: string }
  try { payload = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }

  const ip = clientIp(req)
  const action = payload.action ?? 'login'

  if (action === 'login') {
    const email = (payload.email ?? '').trim().toLowerCase()
    const password = payload.password ?? ''
    if (!email || !password) return json({ error: 'Credenciais inválidas' }, 401)

    // Rate limit: 5 failed attempts / 10 min per IP
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const { count } = await admin
      .from('portal_login_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('ip_address', ip)
      .eq('success', false)
      .gte('attempted_at', tenMinAgo)
    if ((count ?? 0) >= 5) {
      await audit('portal_login_blocked', null, ip, { email })
      return json({ error: 'Muitas tentativas. Tente novamente em alguns minutos.' }, 429)
    }

    const { data: cred } = await admin
      .from('portal_credentials')
      .select('id, client_id, password_hash, is_active')
      .eq('email', email)
      .maybeSingle()

    const ok = cred && cred.is_active && await bcrypt.compare(password, cred.password_hash)
    await admin.from('portal_login_attempts').insert({ ip_address: ip, email, success: !!ok })

    if (!ok || !cred) {
      await audit('portal_login_failed', cred?.client_id ?? null, ip, { email })
      return json({ error: 'Credenciais inválidas' }, 401)
    }

    const { data: client } = await admin
      .from('clients')
      .select('id, name, portal_access_enabled')
      .eq('id', cred.client_id)
      .single()

    if (!client || !client.portal_access_enabled) {
      await audit('portal_login_disabled', cred.client_id, ip, { email })
      return json({ error: 'Credenciais inválidas' }, 401)
    }

    const { data: session, error: sessErr } = await admin
      .from('portal_sessions')
      .insert({ client_id: cred.client_id, credential_id: cred.id, ip_address: ip })
      .select('token, expires_at')
      .single()
    if (sessErr || !session) return json({ error: 'Falha ao criar sessão' }, 500)

    await admin.from('portal_credentials').update({ last_login_at: new Date().toISOString() }).eq('id', cred.id)
    await audit('portal_login_success', cred.client_id, ip, { email })

    return json({
      token: session.token,
      client_id: cred.client_id,
      client_name: client.name,
      expires_at: session.expires_at,
    })
  }

  if (action === 'validate') {
    const token = payload.token
    if (!token) return json({ error: 'Token ausente' }, 401)
    const { data: session } = await admin
      .from('portal_sessions')
      .select('client_id, expires_at, last_activity_at')
      .eq('token', token)
      .maybeSingle()
    if (!session) return json({ error: 'Sessão inválida' }, 401)
    if (new Date(session.expires_at).getTime() < Date.now()) return json({ error: 'Sessão expirada' }, 401)
    // 2h inactivity invalidates
    if (Date.now() - new Date(session.last_activity_at).getTime() > 2 * 60 * 60 * 1000) {
      await admin.from('portal_sessions').delete().eq('token', token)
      return json({ error: 'Sessão expirada por inatividade' }, 401)
    }
    await admin.from('portal_sessions').update({ last_activity_at: new Date().toISOString() }).eq('token', token)
    const { data: client } = await admin
      .from('clients')
      .select('id, name, portal_access_enabled')
      .eq('id', session.client_id)
      .single()
    if (!client || !client.portal_access_enabled) return json({ error: 'Acesso desativado' }, 401)
    return json({ client_id: client.id, client_name: client.name })
  }

  if (action === 'logout') {
    const token = payload.token
    if (token) await admin.from('portal_sessions').delete().eq('token', token)
    return json({ ok: true })
  }

  return json({ error: 'Ação inválida' }, 400)
})