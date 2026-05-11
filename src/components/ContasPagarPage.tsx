import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { RefreshButton } from "@/components/RefreshButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, CheckCircle2, Download, Settings, X } from "lucide-react";

type Recurrence = "unica" | "mensal" | "trimestral" | "anual";
type BillStatus = "pendente" | "paga" | "vencida";

interface Bill {
  id: string;
  description: string;
  category: string;
  amount: number;
  due_date: string;
  recurrence: Recurrence;
  status: BillStatus;
  paid_at: string | null;
  paid_amount: number | null;
  payment_method: string | null;
  obs: string | null;
  created_at: string;
}

const RECURRENCE_LABEL: Record<Recurrence, string> = {
  unica: "Única",
  mensal: "Mensal",
  trimestral: "Trimestral",
  anual: "Anual",
};

const PAYMENT_METHODS = ["PIX", "Boleto", "Débito", "Dinheiro"];

const DEFAULT_CATEGORIES = [
  "Água",
  "Energia Elétrica",
  "Aluguel",
  "Combustível",
  "Manutenção de Equipamentos",
  "Honorários Contábeis",
  "Telefone/Internet",
  "Impostos e Taxas",
  "Salários",
  "Outros",
];

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const todayISO = () => new Date().toISOString().slice(0, 10);

function addToDate(iso: string, recurrence: Recurrence): string {
  const d = new Date(iso + "T00:00:00");
  if (recurrence === "mensal") d.setMonth(d.getMonth() + 1);
  else if (recurrence === "trimestral") d.setMonth(d.getMonth() + 3);
  else if (recurrence === "anual") d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

type Visual = { label: string; cls: string };
function visualStatus(b: Bill): Visual {
  if (b.status === "paga") return { label: "PAGA", cls: "bg-muted text-muted-foreground" };
  const today = todayISO();
  if (b.due_date < today) return { label: "VENCIDA", cls: "bg-destructive text-destructive-foreground" };
  if (b.due_date === today) return { label: "VENCE HOJE", cls: "bg-orange-500 text-white" };
  const d = new Date(b.due_date + "T00:00:00").getTime();
  const diff = (d - new Date(today + "T00:00:00").getTime()) / 86400000;
  if (diff <= 7) return { label: "VENCE EM BREVE", cls: "bg-yellow-400 text-black" };
  return { label: "EM DIA", cls: "bg-green-600 text-white" };
}

export function ContasPagarPage() {
  const { user } = useAuth();
  const role = user?.role;
  const isAdmin = role === "admin";
  const canEdit = isAdmin || role === "financeiro";

  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterStatus, setFilterStatus] = useState<"todas" | "pendente" | "vencida" | "paga">("todas");
  const [filterCategory, setFilterCategory] = useState<string>("todas");
  const now = new Date();
  const [filterMonth, setFilterMonth] = useState<string>(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
  );

  const [openNew, setOpenNew] = useState(false);
  const [editing, setEditing] = useState<Bill | null>(null);
  const [form, setForm] = useState({
    description: "",
    category: "Outros",
    amount: "",
    due_date: todayISO(),
    recurrence: "unica" as Recurrence,
    obs: "",
  });
  const [installments, setInstallments] = useState(1);

  // Custom categories
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  const allCategories = useMemo(() => {
    const merged = [...DEFAULT_CATEGORIES];
    for (const c of customCategories) {
      if (!merged.includes(c)) merged.push(c);
    }
    return merged;
  }, [customCategories]);

  const loadCustomCategories = async () => {
    const { data } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "bill_categories")
      .maybeSingle();
    if (data?.value && Array.isArray(data.value)) {
      setCustomCategories(data.value as string[]);
    }
  };

  const saveCustomCategory = async () => {
    const name = newCatName.trim();
    if (!name) return;
    if (allCategories.includes(name)) {
      toast.error("Categoria já existe");
      return;
    }
    const updated = [...customCategories, name];
    const { error } = await supabase
      .from("system_settings")
      .upsert({ key: "bill_categories", value: updated as any, updated_by: user?.id }, { onConflict: "key" });
    if (error) return toast.error(error.message);
    setCustomCategories(updated);
    setNewCatName("");
    toast.success("Categoria adicionada");
  };

  const removeCustomCategory = async (cat: string) => {
    const updated = customCategories.filter((c) => c !== cat);
    const { error } = await supabase
      .from("system_settings")
      .upsert({ key: "bill_categories", value: updated as any, updated_by: user?.id }, { onConflict: "key" });
    if (error) return toast.error(error.message);
    setCustomCategories(updated);
    toast.success("Categoria removida");
  };

  const [payOpen, setPayOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<Bill | null>(null);
  const [payForm, setPayForm] = useState({
    paid_at: todayISO(),
    paid_amount: "",
    payment_method: "PIX",
    obs: "",
  });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("bills")
      .select("*")
      .order("due_date", { ascending: true });
    if (error) {
      toast.error("Erro ao carregar contas: " + error.message);
    } else {
      setBills((data ?? []) as Bill[]);
    }
    setLoading(false);
  };

  const refreshAll = useCallback(async () => {
    await Promise.all([load(), loadCustomCategories()]);
  }, []);
  const { refresh, isRefreshing, lastRefreshAt } = useAutoRefresh(refreshAll);

  const filtered = useMemo(() => {
    const today = todayISO();
    return bills
      .filter((b) => {
        if (filterStatus === "todas") return true;
        if (filterStatus === "paga") return b.status === "paga";
        if (filterStatus === "vencida") return b.status !== "paga" && b.due_date < today;
        if (filterStatus === "pendente") return b.status === "pendente";
        return true;
      })
      .filter((b) => (filterCategory === "todas" ? true : b.category === filterCategory))
      .filter((b) => b.due_date.startsWith(filterMonth))
      .sort((a, b) => {
        const aOver = a.status !== "paga" && a.due_date < today ? 0 : 1;
        const bOver = b.status !== "paga" && b.due_date < today ? 0 : 1;
        if (aOver !== bOver) return aOver - bOver;
        return a.due_date.localeCompare(b.due_date);
      });
  }, [bills, filterStatus, filterCategory, filterMonth]);

  const kpis = useMemo(() => {
    const today = new Date(todayISO() + "T00:00:00").getTime();
    const in30 = today + 30 * 86400000;
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    let dueIn30 = 0,
      overdue = 0,
      paidThisMonth = 0,
      active = 0;
    for (const b of bills) {
      const t = new Date(b.due_date + "T00:00:00").getTime();
      if (b.status !== "paga") {
        active++;
        if (t < today) overdue += Number(b.amount);
        else if (t <= in30) dueIn30 += Number(b.amount);
      }
      if (b.status === "paga" && b.paid_at && b.paid_at >= monthStart) {
        paidThisMonth += Number(b.paid_amount ?? b.amount);
      }
    }
    return { dueIn30, overdue, paidThisMonth, active };
  }, [bills]);

  const resetForm = () => {
    setForm({
      description: "",
      category: "Outros",
      amount: "",
      due_date: todayISO(),
      recurrence: "unica",
      obs: "",
    });
    setEditing(null);
    setInstallments(1);
  };

  const openEdit = (b: Bill) => {
    setEditing(b);
    setForm({
      description: b.description,
      category: b.category,
      amount: String(b.amount),
      due_date: b.due_date,
      recurrence: b.recurrence,
      obs: b.obs ?? "",
    });
    setOpenNew(true);
  };

  const saveBill = async () => {
    if (!form.description.trim() || !form.amount || !form.due_date) {
      toast.error("Preencha descrição, valor e vencimento");
      return;
    }
    if (editing) {
      const payload = {
        description: form.description.trim(),
        category: form.category,
        amount: Number(form.amount),
        due_date: form.due_date,
        recurrence: form.recurrence,
        obs: form.obs || null,
      };
      const { error } = await supabase.from("bills").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Conta atualizada");
    } else {
      const numParcelas = form.recurrence === "mensal" && installments > 1 ? installments : 1;
      const baseAmount = Number(form.amount);
      const rows = [];
      for (let i = 0; i < numParcelas; i++) {
        const d = new Date(form.due_date + "T00:00:00");
        d.setMonth(d.getMonth() + i);
        const dueDate = d.toISOString().slice(0, 10);
        const desc = numParcelas > 1
          ? `PARCELA ${i + 1}/${numParcelas} — ${form.description.trim()}`
          : form.description.trim();
        rows.push({
          description: desc,
          category: form.category,
          amount: baseAmount,
          due_date: dueDate,
          recurrence: "unica" as Recurrence,
          obs: form.obs || null,
          status: "pendente",
          created_by: user?.id,
        });
      }
      const { error } = await supabase.from("bills").insert(rows);
      if (error) return toast.error(error.message);
      toast.success(numParcelas > 1 ? `${numParcelas} parcelas criadas` : "Conta criada");
    }
    setOpenNew(false);
    resetForm();
    load();
  };

  const deleteBill = async (b: Bill) => {
    if (!confirm(`Excluir "${b.description}"?`)) return;
    const { error } = await supabase.from("bills").delete().eq("id", b.id);
    if (error) return toast.error(error.message);
    toast.success("Conta excluída");
    load();
  };

  const openPay = (b: Bill) => {
    setPayTarget(b);
    setPayForm({
      paid_at: todayISO(),
      paid_amount: String(b.amount),
      payment_method: "PIX",
      obs: "",
    });
    setPayOpen(true);
  };

  const confirmPay = async () => {
    if (!payTarget) return;
    const { error } = await supabase
      .from("bills")
      .update({
        status: "paga",
        paid_at: payForm.paid_at,
        paid_amount: Number(payForm.paid_amount || payTarget.amount),
        payment_method: payForm.payment_method,
        obs: payForm.obs || payTarget.obs,
      })
      .eq("id", payTarget.id);
    if (error) return toast.error(error.message);

    if (payTarget.recurrence !== "unica") {
      const nextDue = addToDate(payTarget.due_date, payTarget.recurrence);
      const { error: e2 } = await supabase.from("bills").insert({
        description: payTarget.description,
        category: payTarget.category,
        amount: payTarget.amount,
        due_date: nextDue,
        recurrence: payTarget.recurrence,
        status: "pendente",
        obs: payTarget.obs,
        created_by: user?.id,
      });
      if (e2) toast.error("Pagamento ok, mas falhou gerar próxima: " + e2.message);
      else toast.success("Pago. Próxima parcela gerada.");
    } else {
      toast.success("Conta marcada como paga");
    }
    setPayOpen(false);
    setPayTarget(null);
    load();
  };

  const exportCSV = () => {
    const headers = ["Status", "Descrição", "Categoria", "Valor", "Vencimento", "Recorrência", "Pago em", "Valor pago", "Forma", "Obs"];
    const rows = filtered.map((b) => [
      visualStatus(b).label,
      b.description,
      b.category,
      String(b.amount).replace(".", ","),
      b.due_date,
      RECURRENCE_LABEL[b.recurrence],
      b.paid_at ?? "",
      b.paid_amount != null ? String(b.paid_amount).replace(".", ",") : "",
      b.payment_method ?? "",
      (b.obs ?? "").replace(/\n/g, " "),
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contas-pagar-${filterMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Contas a Pagar</h1>
        <div className="flex items-center gap-2">
          <RefreshButton onRefresh={refresh} isRefreshing={isRefreshing} lastRefreshAt={lastRefreshAt} />
          {canEdit && (
          <Button
            size="sm"
            onClick={() => {
              resetForm();
              setOpenNew(true);
            }}
          >
            <Plus className="h-4 w-4" /> Nova Conta
          </Button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-destructive/40">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">A vencer em 30 dias</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-lg font-bold text-destructive">{fmtBRL(kpis.dueIn30)}</div>
          </CardContent>
        </Card>
        <Card className="border-destructive">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">Vencidas</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-lg font-bold text-destructive">{fmtBRL(kpis.overdue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">Pagas este mês</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-lg font-bold text-green-600">{fmtBRL(kpis.paidThisMonth)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">Contas ativas</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-lg font-bold">{kpis.active}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-3 flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Select value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)}>
              <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="pendente">Pendentes</SelectItem>
                <SelectItem value="vencida">Vencidas</SelectItem>
                <SelectItem value="paga">Pagas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Categoria</Label>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="h-8 w-48 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {allCategories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isAdmin && (
            <div className="space-y-1">
              <Label className="text-xs">&nbsp;</Label>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setCatModalOpen(true)} title="Gerenciar categorias">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs">Mês</Label>
            <Input
              type="month"
              className="h-8 w-40 text-xs"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
            />
          </div>
          <div className="ml-auto">
            <Button size="sm" variant="outline" onClick={exportCSV}>
              <Download className="h-4 w-4" /> Exportar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Descrição</TableHead>
                <TableHead className="text-xs">Categoria</TableHead>
                <TableHead className="text-xs text-right">Valor</TableHead>
                <TableHead className="text-xs">Vencimento</TableHead>
                <TableHead className="text-xs">Recorrência</TableHead>
                <TableHead className="text-xs text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-6">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-6">Nenhuma conta encontrada</TableCell></TableRow>
              ) : (
                filtered.map((b) => {
                  const v = visualStatus(b);
                  return (
                    <TableRow key={b.id}>
                      <TableCell className="py-2">
                        <Badge className={`${v.cls} text-[10px]`}>{v.label}</Badge>
                      </TableCell>
                      <TableCell className="py-2 text-xs font-medium">{b.description}</TableCell>
                      <TableCell className="py-2 text-xs">{b.category}</TableCell>
                      <TableCell className="py-2 text-xs text-right">{fmtBRL(Number(b.amount))}</TableCell>
                      <TableCell className="py-2 text-xs">
                        {new Date(b.due_date + "T00:00:00").toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="py-2 text-xs">{RECURRENCE_LABEL[b.recurrence]}</TableCell>
                      <TableCell className="py-2 text-right">
                        <div className="flex justify-end gap-1">
                          {b.status !== "paga" && canEdit && (
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-green-700" onClick={() => openPay(b)}>
                              <CheckCircle2 className="h-3 w-3" /> Pagar
                            </Button>
                          )}
                          {canEdit && (
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(b)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                          )}
                          {isAdmin && (
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteBill(b)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal Nova/Editar */}
      <Dialog open={openNew} onOpenChange={(o) => { setOpenNew(o); if (!o) resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Conta" : "Nova Conta"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Descrição</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Categoria</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {allCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Valor R$</Label>
                <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Vencimento</Label>
                <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Recorrência</Label>
                <Select value={form.recurrence} onValueChange={(v: Recurrence) => setForm({ ...form, recurrence: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(RECURRENCE_LABEL) as Recurrence[]).map((r) => (
                      <SelectItem key={r} value={r}>{RECURRENCE_LABEL[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {!editing && form.recurrence === "mensal" && (
              <div className="space-y-1">
                <Label className="text-xs">Número de Parcelas</Label>
                <Input
                  type="number"
                  min={1}
                  max={120}
                  value={installments}
                  onChange={(e) => setInstallments(Math.max(1, Math.min(120, Number(e.target.value) || 1)))}
                />
                {installments > 1 && form.amount && form.due_date && (
                  <div className="text-xs text-muted-foreground bg-muted p-2 rounded mt-1">
                    Serão criadas <strong>{installments} parcelas</strong> de{" "}
                    <strong>{fmtBRL(Number(form.amount))}</strong>, de{" "}
                    {new Date(form.due_date + "T00:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })} até{" "}
                    {(() => {
                      const d = new Date(form.due_date + "T00:00:00");
                      d.setMonth(d.getMonth() + installments - 1);
                      return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
                    })()}
                  </div>
                )}
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Observação</Label>
              <Textarea rows={2} value={form.obs} onChange={(e) => setForm({ ...form, obs: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNew(false)}>Cancelar</Button>
            <Button onClick={saveBill}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Pagamento */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar como Paga — {payTarget?.description}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Data do pagamento</Label>
              <Input type="date" value={payForm.paid_at} onChange={(e) => setPayForm({ ...payForm, paid_at: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Valor pago</Label>
              <Input type="number" step="0.01" value={payForm.paid_amount} onChange={(e) => setPayForm({ ...payForm, paid_amount: e.target.value })} />
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Forma de pagamento</Label>
              <Select value={payForm.payment_method} onValueChange={(v) => setPayForm({ ...payForm, payment_method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Observação</Label>
              <Textarea rows={2} value={payForm.obs} onChange={(e) => setPayForm({ ...payForm, obs: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>Cancelar</Button>
            <Button onClick={confirmPay}>Confirmar Pagamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Categorias */}
      <Dialog open={catModalOpen} onOpenChange={setCatModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerenciar Categorias</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Nome da nova categoria"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveCustomCategory()}
              />
              <Button size="sm" onClick={saveCustomCategory}>Adicionar</Button>
            </div>
            <div className="text-xs text-muted-foreground">Categorias padrão:</div>
            <div className="flex flex-wrap gap-1">
              {DEFAULT_CATEGORIES.map((c) => (
                <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>
              ))}
            </div>
            {customCategories.length > 0 && (
              <>
                <div className="text-xs text-muted-foreground">Categorias personalizadas:</div>
                <div className="flex flex-wrap gap-1">
                  {customCategories.map((c) => (
                    <Badge key={c} variant="outline" className="text-xs flex items-center gap-1">
                      {c}
                      <button onClick={() => removeCustomCategory(c)} className="hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatModalOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ContasPagarPage;