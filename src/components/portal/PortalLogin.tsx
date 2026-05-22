import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { usePortalAuth } from '@/hooks/usePortalAuth'

export function PortalLogin() {
  const { login, isAuthenticated, isLoading } = usePortalAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!isLoading && isAuthenticated) navigate('/portal/dashboard', { replace: true })
  }, [isLoading, isAuthenticated, navigate])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null); setBusy(true)
    try {
      await login(email, password)
      navigate('/portal/dashboard', { replace: true })
    } catch (e: any) {
      setErr(e?.message ?? 'Credenciais inválidas')
    } finally { setBusy(false) }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-3xl font-black tracking-tight">
            <span className="text-white">SUCATA</span>{' '}
            <span className="text-red-600">UNIÃO</span>
          </div>
          <p className="text-xs uppercase tracking-widest text-white/60 mt-2">Portal do Fornecedor</p>
        </div>
        <form onSubmit={onSubmit} className="bg-black border border-red-600/30 rounded-md p-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs text-white/70">Email</Label>
            <Input id="email" type="email" autoComplete="username" required value={email}
              onChange={e => setEmail(e.target.value)}
              className="bg-gray-900 border-gray-700 text-white" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs text-white/70">Senha</Label>
            <Input id="password" type="password" autoComplete="current-password" required value={password}
              onChange={e => setPassword(e.target.value)}
              className="bg-gray-900 border-gray-700 text-white" />
          </div>
          {err && <p className="text-xs text-red-500 bg-red-600/10 border border-red-600/40 rounded p-2">{err}</p>}
          <Button type="submit" disabled={busy} className="w-full bg-red-600 hover:bg-red-700 text-white">
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Entrar
          </Button>
          <div className="text-center pt-2">
            <Link to="/" className="text-[11px] text-white/50 hover:text-red-500 transition-colors">
              Acesso ao sistema interno →
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}