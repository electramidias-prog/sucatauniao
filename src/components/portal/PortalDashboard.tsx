import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, FileDown, Loader2, RefreshCw, Wallet } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { callPortalData, usePortalAuth } from '@/hooks/usePortalAuth'
import { PortalLayout } from './PortalLayout'
import { generateTicketPDF } from './PortalTicketPDF'

interface Transaction {
  id: string
  type: string
  amount: number
  status: string
  description: string
  transaction_date: string | null
  created_at: string
}
interface WeighingRow {
  id: string
  ticket_number: number
  vehicle_plate: string | null
  status: string
  material_type: string | null
  final_net_weight: number | null
  net_weight: number | null
  total_value: number | null
  price_per_kg: number | null
  created_at: string
}
interface Overview {
  client: { id: string; name: string; document_number: string; document_type: string }
  balance: number
  transactions: Transaction[]
  weighings: WeighingRow[]
}

const fmtMoney = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtKg = (n: number | null | undefined) =>
  (Number(n ?? 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDateTime = (s: string) => new Date(s).toLocaleString('pt-BR')
const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString('pt-BR') : '—')

const PAGE_SIZE = 15

export function PortalDashboard() {
  const { token, clientId, isLoading, isAuthenticated } = usePortalAuth()
  const navigate = useNavigate()
  const [overview, setOverview] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [downloading, setDownloading] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate('/portal/login', { replace: true })
  }, [isLoading, isAuthenticated, navigate])

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true); setErr(null)
    const r = await callPortalData<Overview>(token, 'overview')
    if (!r.ok) setErr(r.error ?? 'Falha ao carregar dados')
    else setOverview(r.data)
    setLoading(false)
  }, [token])

  useEffect(() => { load() }, [load])

  // polling 30s as safe realtime substitute
  useEffect(() => {
    if (!token) return
    const id = setInterval(() => { load() }, 30000)
    return () => clearInterval(id)
  }, [token, load])

  const transactions = overview?.transactions ?? []
  const weighings = overview?.weighings ?? []
  const balance = overview?.balance ?? 0

  const payments = useMemo(
    () => transactions.filter(t => t.type === 'debito' && (t.status === 'pago' || t.status === 'confirmado')),
    [transactions],
  )
  const pendingVales = useMemo(
    () => transactions.filter(t =>
      t.type === 'debito' && (
        t.status === 'pendente' || t.status === 'aberto' ||
        /vale|adiantamento/i.test(t.description ?? '')
      ) && t.status !== 'pago' && t.status !== 'confirmado',
    ),
    [transactions],
  )
  const totalVales = pendingVales.reduce((a, t) => a + Number(t.amount || 0), 0)

  // statement with running balance (oldest → newest)
  const statement = useMemo(() => {
    const sorted = [...transactions].sort((a, b) =>
      new Date(a.transaction_date ?? a.created_at).getTime() -
      new Date(b.transaction_date ?? b.created_at).getTime(),
    )
    let acc = 0
    return sorted.map(t => {
      const v = Number(t.amount || 0) * (t.type === 'credito' ? 1 : -1)
      acc += v
      return { ...t, signed: v, running: acc }
    }).reverse()
  }, [transactions])

  const pagedWeighings = weighings.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.max(1, Math.ceil(weighings.length / PAGE_SIZE))

  const exportStatementCSV = () => {
    const rows = [['Data', 'Descrição', 'Tipo', 'Valor', 'Saldo']]
    statement.forEach(t => rows.push([
      fmtDate(t.transaction_date ?? t.created_at),
      t.description ?? '',
      t.type === 'credito' ? 'Entrada' : 'Saída',
      String(t.signed.toFixed(2)).replace('.', ','),
      String(t.running.toFixed(2)).replace('.', ','),
    ]))
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `extrato-${clientId?.slice(0, 8)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const downloadTicket = async (id: string) => {
    if (!token) return
    setDownloading(id)
    const r = await callPortalData<{ weighing: any; fractions: any[]; client: any }>(token, 'ticket', { weighing_id: id })
    setDownloading(null)
    if (!r.ok || !r.data) { alert(r.error ?? 'Falha ao gerar PDF'); return }
    generateTicketPDF(r.data)
  }

  if (isLoading || (loading && !overview)) {
    return (
      <PortalLayout>
        <div className="flex items-center justify-center h-[60vh]"><Loader2 className="h-6 w-6 animate-spin text-red-600" /></div>
      </PortalLayout>
    )
  }

  return (
    <PortalLayout>
      {err && <div className="text-xs text-red-400 bg-red-600/10 border border-red-600/40 rounded p-2 mb-4">{err}</div>}

      {/* Saldo */}
      <Card className="bg-black border-red-600/30 p-5 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/60 mb-1">
              <Wallet className="h-3.5 w-3.5" /> Saldo Atual
            </div>
            <div className="text-4xl font-black text-white">{fmtMoney(balance)}</div>
            <div className="mt-2">
              {balance > 0
                ? <Badge className="bg-green-600 hover:bg-green-600 text-white">Saldo disponível</Badge>
                : <Badge className="bg-red-600 hover:bg-red-600 text-white">{balance < 0 ? 'Saldo devedor' : 'Saldo zerado'}</Badge>}
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={load}
            className="border-red-600/60 text-red-500 hover:bg-red-600 hover:text-white">
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Atualizar
          </Button>
        </div>
        {totalVales > 0 && (
          <div className="mt-4 text-xs text-red-400 border-t border-red-600/20 pt-3">
            Vales/Adiantamentos em aberto: <span className="font-bold">{fmtMoney(totalVales)}</span>
          </div>
        )}
      </Card>

      <Tabs defaultValue="pesagens">
        <TabsList className="bg-black border border-red-600/30 grid grid-cols-4 w-full">
          <TabsTrigger value="pesagens" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">Pesagens</TabsTrigger>
          <TabsTrigger value="pagamentos" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">Pagamentos</TabsTrigger>
          <TabsTrigger value="vales" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">Vales</TabsTrigger>
          <TabsTrigger value="extrato" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">Extrato</TabsTrigger>
        </TabsList>

        {/* PESAGENS */}
        <TabsContent value="pesagens" className="mt-4">
          <Card className="bg-black border-red-600/20 overflow-hidden">
            {weighings.length === 0 ? (
              <div className="p-8 text-center text-sm text-white/50">Nenhuma pesagem registrada ainda.</div>
            ) : (
              <>
                <table className="w-full text-[12px]">
                  <thead className="bg-gray-900 text-white/70 uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="px-3 py-2 text-left">Data/Hora</th>
                      <th className="px-3 py-2 text-left">Ticket</th>
                      <th className="px-3 py-2 text-left">Placa</th>
                      <th className="px-3 py-2 text-left">Material</th>
                      <th className="px-3 py-2 text-right">Líquido (kg)</th>
                      <th className="px-3 py-2 text-right">R$/kg</th>
                      <th className="px-3 py-2 text-right">Total</th>
                      <th className="px-3 py-2 text-center">Status</th>
                      <th className="px-3 py-2 text-center">PDF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedWeighings.map(w => {
                      const isFinal = w.status === 'finalizado'
                      return (
                        <tr key={w.id} className="border-t border-white/5 hover:bg-white/5">
                          <td className="px-3 py-1.5">{fmtDateTime(w.created_at)}</td>
                          <td className="px-3 py-1.5 font-mono">#{w.ticket_number}</td>
                          <td className="px-3 py-1.5 font-mono">{w.vehicle_plate ?? '—'}</td>
                          <td className="px-3 py-1.5">{w.material_type ?? '—'}</td>
                          <td className="px-3 py-1.5 text-right">{fmtKg(w.final_net_weight ?? w.net_weight)}</td>
                          <td className="px-3 py-1.5 text-right">{isFinal ? fmtMoney(Number(w.price_per_kg ?? 0)) : '—'}</td>
                          <td className="px-3 py-1.5 text-right font-medium">{isFinal ? fmtMoney(Number(w.total_value ?? 0)) : '—'}</td>
                          <td className="px-3 py-1.5 text-center">
                            <Badge className={isFinal ? 'bg-green-700 hover:bg-green-700' : 'bg-yellow-700 hover:bg-yellow-700'}>{w.status}</Badge>
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            {isFinal && (
                              <Button size="icon" variant="ghost" disabled={downloading === w.id}
                                onClick={() => downloadTicket(w.id)}
                                className="h-6 w-6 text-red-500 hover:bg-red-600 hover:text-white">
                                {downloading === w.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileDown className="h-3 w-3" />}
                              </Button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <div className="flex items-center justify-between px-3 py-2 border-t border-white/10 text-xs">
                  <span className="text-white/60">Página {page + 1} / {totalPages} · {weighings.length} registros</span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)} className="h-7 border-white/20 text-white hover:bg-white/10">Anterior</Button>
                    <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="h-7 border-white/20 text-white hover:bg-white/10">Próximo</Button>
                  </div>
                </div>
              </>
            )}
          </Card>
        </TabsContent>

        {/* PAGAMENTOS */}
        <TabsContent value="pagamentos" className="mt-4">
          <Card className="bg-black border-red-600/20 overflow-hidden">
            {payments.length === 0 ? (
              <div className="p-8 text-center text-sm text-white/50">Nenhum pagamento recebido ainda.</div>
            ) : (
              <table className="w-full text-[12px]">
                <thead className="bg-gray-900 text-white/70 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-3 py-2 text-left">Data</th>
                    <th className="px-3 py-2 text-left">Descrição</th>
                    <th className="px-3 py-2 text-right">Valor Pago</th>
                    <th className="px-3 py-2 text-center">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map(t => (
                    <tr key={t.id} className="border-t border-white/5 hover:bg-white/5">
                      <td className="px-3 py-1.5">{fmtDate(t.transaction_date ?? t.created_at)}</td>
                      <td className="px-3 py-1.5">{t.description}</td>
                      <td className="px-3 py-1.5 text-right font-medium">{fmtMoney(Number(t.amount))}</td>
                      <td className="px-3 py-1.5 text-center">
                        <Badge className="bg-green-700 hover:bg-green-700">{t.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </TabsContent>

        {/* VALES */}
        <TabsContent value="vales" className="mt-4 space-y-3">
          <Card className="bg-black border-red-600/40 p-4">
            <div className="text-xs uppercase tracking-wider text-white/60">Total em aberto</div>
            <div className="text-2xl font-black text-red-500">{fmtMoney(totalVales)}</div>
          </Card>
          <Card className="bg-black border-red-600/20 overflow-hidden">
            {pendingVales.length === 0 ? (
              <div className="p-8 text-center text-sm text-white/50">Nenhum vale ou adiantamento em aberto.</div>
            ) : (
              <table className="w-full text-[12px]">
                <thead className="bg-gray-900 text-white/70 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-3 py-2 text-left">Data</th>
                    <th className="px-3 py-2 text-left">Descrição</th>
                    <th className="px-3 py-2 text-right">Valor</th>
                    <th className="px-3 py-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingVales.map(t => (
                    <tr key={t.id} className="border-t border-white/5">
                      <td className="px-3 py-1.5">{fmtDate(t.transaction_date ?? t.created_at)}</td>
                      <td className="px-3 py-1.5">{t.description}</td>
                      <td className="px-3 py-1.5 text-right text-red-400 font-medium">{fmtMoney(Number(t.amount))}</td>
                      <td className="px-3 py-1.5 text-center"><Badge className="bg-yellow-700 hover:bg-yellow-700">{t.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </TabsContent>

        {/* EXTRATO */}
        <TabsContent value="extrato" className="mt-4">
          <div className="flex justify-end mb-2">
            <Button size="sm" onClick={exportStatementCSV} disabled={statement.length === 0}
              className="bg-red-600 hover:bg-red-700 text-white">
              <Download className="h-3.5 w-3.5 mr-1" /> Exportar CSV
            </Button>
          </div>
          <Card className="bg-black border-red-600/20 overflow-hidden">
            {statement.length === 0 ? (
              <div className="p-8 text-center text-sm text-white/50">Sem movimentações.</div>
            ) : (
              <table className="w-full text-[12px]">
                <thead className="bg-gray-900 text-white/70 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-3 py-2 text-left">Data</th>
                    <th className="px-3 py-2 text-left">Descrição</th>
                    <th className="px-3 py-2 text-center">Tipo</th>
                    <th className="px-3 py-2 text-right">Valor</th>
                    <th className="px-3 py-2 text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {statement.map(t => (
                    <tr key={t.id} className="border-t border-white/5 hover:bg-white/5">
                      <td className="px-3 py-1.5">{fmtDate(t.transaction_date ?? t.created_at)}</td>
                      <td className="px-3 py-1.5">{t.description}</td>
                      <td className="px-3 py-1.5 text-center">
                        {t.signed >= 0
                          ? <Badge className="bg-green-700 hover:bg-green-700">Entrada</Badge>
                          : <Badge className="bg-red-700 hover:bg-red-700">Saída</Badge>}
                      </td>
                      <td className={`px-3 py-1.5 text-right font-medium ${t.signed >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {fmtMoney(t.signed)}
                      </td>
                      <td className="px-3 py-1.5 text-right font-bold">{fmtMoney(t.running)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </PortalLayout>
  )
}