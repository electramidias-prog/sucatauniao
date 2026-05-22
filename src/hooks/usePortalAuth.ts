import { useCallback, useEffect, useState } from 'react'

const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string
const STORAGE_KEY = 'portal_session_v1'

export interface PortalSession {
  token: string
  client_id: string
  client_name: string
  expires_at?: string
}

function read(): PortalSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function write(s: PortalSession | null) {
  if (s) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  else sessionStorage.removeItem(STORAGE_KEY)
}

async function callAuth(action: string, payload: Record<string, unknown> = {}) {
  const res = await fetch(`${FUNCTIONS_BASE}/portal-auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${ANON}` },
    body: JSON.stringify({ action, ...payload }),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

export async function callPortalData<T = unknown>(token: string, query: string, params?: Record<string, unknown>): Promise<{ ok: boolean; data: T | null; error?: string }> {
  const res = await fetch(`${FUNCTIONS_BASE}/portal-data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${ANON}` },
    body: JSON.stringify({ token, query, params }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return { ok: false, data: null, error: data?.error ?? 'Erro' }
  return { ok: true, data: data as T }
}

export function usePortalAuth() {
  const [session, setSession] = useState<PortalSession | null>(() => read())
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let alive = true
    const s = read()
    if (!s) { setIsLoading(false); return }
    callAuth('validate', { token: s.token }).then(({ ok, data }) => {
      if (!alive) return
      if (ok) {
        const next = { ...s, client_id: data.client_id, client_name: data.client_name }
        write(next); setSession(next)
      } else {
        write(null); setSession(null)
      }
      setIsLoading(false)
    })
    return () => { alive = false }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const { ok, data } = await callAuth('login', { email, password })
    if (!ok) throw new Error(data?.error ?? 'Credenciais inválidas')
    const next: PortalSession = { token: data.token, client_id: data.client_id, client_name: data.client_name, expires_at: data.expires_at }
    write(next); setSession(next)
    return next
  }, [])

  const logout = useCallback(async () => {
    const s = read()
    if (s) await callAuth('logout', { token: s.token })
    write(null); setSession(null)
  }, [])

  return {
    session,
    clientId: session?.client_id ?? null,
    clientName: session?.client_name ?? null,
    token: session?.token ?? null,
    isAuthenticated: !!session,
    isLoading,
    login,
    logout,
  }
}