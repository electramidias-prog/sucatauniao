import { createClient } from 'npm:@supabase/supabase-js@2'

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

async function resolveSession(token: string | undefined) {
  if (!token) return null
  const { data: session } = await admin
    .from('portal_sessions')
    .select('client_id, expires_at, last_activity_at')
    .eq('token', token)
    .maybeSingle()
  if (!session) return null
  if (new Date(session.expires_at).getTime() < Date.now()) return null
  if (Date.now() - new Date(session.last_activity_at).getTime() > 2 * 60 * 60 * 1000) return null
  await admin.from('portal_sessions').update({ last_activity_at: new Date().toISOString() }).eq('token', token)
  return session
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  let body: { token?: string; query: string; params?: Record<string, unknown> }
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }

  const session = await resolveSession(body.token)
  if (!session) return json({ error: 'Sessão inválida' }, 401)
  const clientId = session.client_id

  switch (body.query) {
    case 'overview': {
      const [tx, weighings, client] = await Promise.all([
        admin.from('client_transactions').select('id, type, amount, status, transaction_date, created_at, description').eq('client_id', clientId).order('created_at', { ascending: false }),
        admin.from('weighings').select('id, ticket_number, vehicle_plate, status, material_type, final_net_weight, net_weight, total_value, price_per_kg, created_at').eq('client_id', clientId).order('created_at', { ascending: false }).limit(50),
        admin.from('clients').select('id, name, document_number, document_type').eq('id', clientId).single(),
      ])
      const transactions = tx.data ?? []
      const balance = transactions.reduce((acc, t: any) => acc + (t.type === 'credito' ? Number(t.amount) : -Number(t.amount)), 0)
      return json({
        client: client.data,
        balance,
        transactions,
        weighings: weighings.data ?? [],
      })
    }
    case 'ticket': {
      const ticketId = body.params?.weighing_id as string | undefined
      if (!ticketId) return json({ error: 'weighing_id obrigatório' }, 400)
      const { data: w } = await admin
        .from('weighings')
        .select('*')
        .eq('id', ticketId)
        .eq('client_id', clientId)
        .maybeSingle()
      if (!w) return json({ error: 'Ticket não encontrado' }, 404)
      const { data: fractions } = await admin
        .from('weighing_fractions')
        .select('*')
        .eq('weighing_id', ticketId)
        .order('sequence_number')
      const { data: client } = await admin
        .from('clients')
        .select('id, name, document_number, document_type, vehicle_plate')
        .eq('id', clientId)
        .single()
      return json({ weighing: w, fractions: fractions ?? [], client })
    }
    default:
      return json({ error: 'query inválida' }, 400)
  }
})