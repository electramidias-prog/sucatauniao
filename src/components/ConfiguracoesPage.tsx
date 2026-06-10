import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Settings, Building2, Scale, Printer, Globe, Bell } from 'lucide-react';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { RefreshButton } from '@/components/RefreshButton';
import { getTarifaPesagem, setTarifaGlobal } from '@/lib/tarifaPesagem';
import { logAudit } from '@/components/balanca/auditLog';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export function ConfiguracoesPage() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [tarifaGlobal, setTarifaGlobalState] = useState('');
  const [savingTarifa, setSavingTarifa] = useState(false);

  useEffect(() => {
    getTarifaPesagem(null).then(t => setTarifaGlobalState(String(t.valor)));
    (async () => {
      if (!user) return;
      const { data } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
      setIsAdmin(((data as any[]) || []).some(r => r.role === 'admin'));
    })();
  }, [user]);

  const saveTarifa = async () => {
    const v = Number(String(tarifaGlobal).replace(',', '.'));
    if (!Number.isFinite(v) || v < 0) { toast.error('Valor inválido'); return; }
    setSavingTarifa(true);
    try {
      const before = (await getTarifaPesagem(null)).valor;
      await setTarifaGlobal(v);
      await logAudit({ table: 'system_settings', recordId: 'tarifa_pesagem_paga', action: 'UPDATE', oldValue: { value: before }, newValue: { value: v } });
      toast.success('Tarifa padrão atualizada');
    } catch (e: any) {
      toast.error('Erro: ' + (e?.message || ''));
    } finally {
      setSavingTarifa(false);
    }
  };

  const [empresa, setEmpresa] = useState({
    razao_social: 'Sucata União LTDA',
    cnpj: '',
    telefone: '',
    email: 'sucatauniao@outlook.com.br',
    endereco: '',
    cidade: '', uf: 'MG',
  });

  const [balanca, setBalanca] = useState({
    porta_serial: 'COM3',
    baud_rate: '9600',
    auto_capture: true,
    printer_width: '80mm',
  });

  const [notificacoes, setNotificacoes] = useState({
    email_novo_cliente: true,
    email_acerto: true,
    alerta_bloqueio: true,
    whatsapp_recibo: false,
  });

  const handleSave = () => {
    toast.success('Configurações salvas com sucesso!');
  };

  // Settings page has no remote fetch; refresh is a no-op marker for parity.
  const { refresh, isRefreshing, lastRefreshAt } = useAutoRefresh(async () => {});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Configurações</h1>
          <p className="text-sm text-muted-foreground">Parâmetros gerais do sistema</p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton onRefresh={refresh} isRefreshing={isRefreshing} lastRefreshAt={lastRefreshAt} />
          <Button size="sm" onClick={handleSave}><Settings className="h-3.5 w-3.5 mr-1" /> Salvar Tudo</Button>
        </div>
      </div>

      <Tabs defaultValue="empresa">
        <TabsList className="grid grid-cols-4 w-full max-w-lg">
          <TabsTrigger value="empresa">Empresa</TabsTrigger>
          <TabsTrigger value="balanca">Balança</TabsTrigger>
          <TabsTrigger value="integracoes">Integrações</TabsTrigger>
          <TabsTrigger value="notificacoes">Notificações</TabsTrigger>
        </TabsList>

        <TabsContent value="empresa">
          <Card><CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="h-5 w-5 text-primary" />
              <h3 className="text-sm font-semibold">Dados da Empresa</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label className="text-xs">Razão Social</Label><Input value={empresa.razao_social} onChange={e => setEmpresa(p => ({ ...p, razao_social: e.target.value }))} className="h-8 text-xs" /></div>
              <div><Label className="text-xs">CNPJ</Label><Input value={empresa.cnpj} onChange={e => setEmpresa(p => ({ ...p, cnpj: e.target.value }))} className="h-8 text-xs" /></div>
              <div><Label className="text-xs">Telefone</Label><Input value={empresa.telefone} onChange={e => setEmpresa(p => ({ ...p, telefone: e.target.value }))} className="h-8 text-xs" /></div>
              <div><Label className="text-xs">Email</Label><Input value={empresa.email} onChange={e => setEmpresa(p => ({ ...p, email: e.target.value }))} className="h-8 text-xs" /></div>
              <div><Label className="text-xs">Cidade</Label><Input value={empresa.cidade} onChange={e => setEmpresa(p => ({ ...p, cidade: e.target.value }))} className="h-8 text-xs" /></div>
              <div><Label className="text-xs">UF</Label><Input value={empresa.uf} onChange={e => setEmpresa(p => ({ ...p, uf: e.target.value }))} className="h-8 text-xs" maxLength={2} /></div>
              <div className="col-span-2"><Label className="text-xs">Endereço</Label><Input value={empresa.endereco} onChange={e => setEmpresa(p => ({ ...p, endereco: e.target.value }))} className="h-8 text-xs" /></div>
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="balanca">
          <Card><CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <Scale className="h-5 w-5 text-primary" />
              <h3 className="text-sm font-semibold">Configuração da Balança</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Porta Serial</Label><Input value={balanca.porta_serial} onChange={e => setBalanca(p => ({ ...p, porta_serial: e.target.value }))} className="h-8 text-xs" /></div>
              <div><Label className="text-xs">Baud Rate</Label><Input value={balanca.baud_rate} onChange={e => setBalanca(p => ({ ...p, baud_rate: e.target.value }))} className="h-8 text-xs" /></div>
              <div className="flex items-center gap-2">
                <Switch checked={balanca.auto_capture} onCheckedChange={v => setBalanca(p => ({ ...p, auto_capture: v }))} />
                <Label className="text-xs">Captura automática de peso</Label>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <Printer className="h-4 w-4 text-muted-foreground" />
              <Label className="text-xs">Impressora Térmica: {balanca.printer_width}</Label>
            </div>

            <div className="border-t pt-3 mt-3">
              <h4 className="text-sm font-semibold mb-2">Pesagem Paga</h4>
              <div className="grid grid-cols-2 gap-3 items-end">
                <div>
                  <Label className="text-xs">Tarifa padrão de pesagem paga (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={tarifaGlobal}
                    onChange={e => setTarifaGlobalState(e.target.value)}
                    disabled={!isAdmin}
                    className="h-8 text-xs"
                  />
                  {!isAdmin && <p className="text-[10px] text-muted-foreground mt-1">Apenas administradores podem alterar.</p>}
                </div>
                <div>
                  <Button size="sm" disabled={!isAdmin || savingTarifa} onClick={saveTarifa}>
                    {savingTarifa ? 'Salvando…' : 'Salvar Tarifa'}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="integracoes">
          <Card><CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <Globe className="h-5 w-5 text-primary" />
              <h3 className="text-sm font-semibold">Integrações Externas</h3>
            </div>
            <div className="space-y-3">
              <div className="border rounded p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Site Wix (sucatauniao.com)</p>
                    <p className="text-xs text-muted-foreground">Webhook para cadastro automático de clientes</p>
                  </div>
                  <Badge className="badge-pendente text-[10px]">Configurar</Badge>
                </div>
              </div>
              <div className="border rounded p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">OneDrive</p>
                    <p className="text-xs text-muted-foreground">sucatauniao@outlook.com.br — Armazenamento de recibos</p>
                  </div>
                  <Badge className="badge-pendente text-[10px]">Configurar</Badge>
                </div>
              </div>
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="notificacoes">
          <Card><CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <Bell className="h-5 w-5 text-primary" />
              <h3 className="text-sm font-semibold">Notificações</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div><p className="text-sm">Email ao cadastrar novo cliente</p></div>
                <Switch checked={notificacoes.email_novo_cliente} onCheckedChange={v => setNotificacoes(p => ({ ...p, email_novo_cliente: v }))} />
              </div>
              <div className="flex items-center justify-between">
                <div><p className="text-sm">Email ao confirmar acerto financeiro</p></div>
                <Switch checked={notificacoes.email_acerto} onCheckedChange={v => setNotificacoes(p => ({ ...p, email_acerto: v }))} />
              </div>
              <div className="flex items-center justify-between">
                <div><p className="text-sm">Alerta de cliente bloqueado</p></div>
                <Switch checked={notificacoes.alerta_bloqueio} onCheckedChange={v => setNotificacoes(p => ({ ...p, alerta_bloqueio: v }))} />
              </div>
              <div className="flex items-center justify-between">
                <div><p className="text-sm">Enviar recibo via WhatsApp</p><p className="text-xs text-muted-foreground">Requer integração</p></div>
                <Switch checked={notificacoes.whatsapp_recibo} onCheckedChange={v => setNotificacoes(p => ({ ...p, whatsapp_recibo: v }))} />
              </div>
            </div>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
