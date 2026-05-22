import { useEffect, useState } from 'react'
import { Copy, KeyRound, Loader2, RefreshCw, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/integrations/supabase/client'

interface Props {
  clientId: string | null
  clientName?: string
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved?: () => void
}

interface Status {
  credential: { id: string; email: string; is_active: boolean; last_login_at: string | null; created_at: string } | null
  portal_access_enabled: boolean
}

function genPassword(len = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%'
  const arr = new Uint8Array(len)
  crypto.getRandomValues(arr)
  return Array.from(arr, b => chars[b % chars.length]).join('')
}

async function callFn(action: string, payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('portal-credentials', { body: { action, ...payload } })
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
  return data
}

export function ClientPortalAccessDialog({ clientId, clientName, open, onOpenChange, onSaved }: Props) {
  const { toast } = useToast()
  const [status, setStatus] = useState<Status | null>(null)
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !clientId) return
    setStatus(null); setEmail(''); setPassword(''); setShowPwd(false); setLoading(true)
    callFn('status', { client_id: clientId })
      .then(s => { setStatus(s); if (s.credential?.email) setEmail(s.credential.email) })
      .catch(e => toast({ title: 'Erro', description: e.message, variant: 'destructive' }))
      .finally(() => setLoading(false))
  }, [open, clientId, toast])

  const toggleActive = async (next: boolean) => {
    if (!clientId) return
    try {
      await callFn('toggle_active', { client_id: clientId, is_active: next })
      setStatus(s => s ? { ...s, portal_access_enabled: next } : s)
      onSaved?.()
      toast({ title: next ? 'Portal ativado' : 'Portal desativado' })
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    }
  }

  const save = async () => {
    if (!clientId) return
    if (!email || !password) { toast({ title: 'Informe email e senha', variant: 'destructive' }); return }
    setSaving(true)
    try {
      await callFn('upsert', { client_id: clientId, email, password })
      toast({ title: 'Credenciais salvas', description: 'Senha não será exibida novamente.' })
      setPassword(''); setShowPwd(false)
      // reload status
      const s = await callFn('status', { client_id: clientId })
      setStatus(s); setEmail(s.credential?.email ?? email)
      onSaved?.()
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-red-600" />
            Portal do Cliente — {clientName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-muted/50 rounded p-3">
              <div>
                <div className="text-xs font-medium">Acesso ao portal</div>
                <div className="text-[11px] text-muted-foreground">
                  {status?.credential
                    ? `Configurado em ${new Date(status.credential.created_at).toLocaleDateString('pt-BR')}`
                    : 'Sem acesso configurado'}
                  {status?.credential?.last_login_at && ` · último login ${new Date(status.credential.last_login_at).toLocaleString('pt-BR')}`}
                </div>
              </div>
              <Switch checked={!!status?.portal_access_enabled} onCheckedChange={toggleActive} />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Email de acesso</Label>
              <Input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="cliente@email.com" />
            </div>

            <div className="space-y-2">
              <Label className="text-xs flex items-center justify-between">
                <span>{status?.credential ? 'Redefinir senha' : 'Senha inicial'}</span>
                <Button type="button" size="sm" variant="ghost" className="h-6 text-[11px]"
                  onClick={() => { const p = genPassword(); setPassword(p); setShowPwd(true) }}>
                  <RefreshCw className="h-3 w-3 mr-1" /> Gerar segura
                </Button>
              </Label>
              <div className="flex gap-1">
                <Input value={password} onChange={e => setPassword(e.target.value)}
                  type={showPwd ? 'text' : 'password'} placeholder="Mínimo 8 caracteres" />
                {password && (
                  <Button type="button" size="icon" variant="outline" className="h-9 w-9"
                    onClick={() => { navigator.clipboard.writeText(password); toast({ title: 'Senha copiada' }) }}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">
                A senha não é exibida novamente após salvar. Anote ou compartilhe com o cliente agora.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={save} disabled={saving || !email || !password} className="bg-red-600 hover:bg-red-700 text-white">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <KeyRound className="h-3.5 w-3.5 mr-1" /> Salvar Credenciais
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}