import { useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { RefreshButton } from "@/components/RefreshButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, FileText, Download, Settings, X } from "lucide-react";

const DEFAULT_CATEGORIES = [
  "Licença Ambiental (LO/LAO)",
  "AVCB",
  "Alvará de Funcionamento",
  "Certificado INMETRO (Balança)",
  "Laudo NR-12",
  "Laudo NR-35",
  "Certificado Digital A1/A3",
  "Outros",
];

interface Doc {
  id: string;
  name: string;
  category: string;
  protocol_number: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  responsible: string | null;
  obs: string | null;
  file_url: string | null;
}

interface FormState {
  name: string;
  category: string;
  protocol_number: string;
  issue_date: string;
  expiry_date: string;
  responsible: string;
  obs: string;
  file: File | null;
}

const emptyForm: FormState = {
  name: "", category: DEFAULT_CATEGORIES[0], protocol_number: "",
  issue_date: "", expiry_date: "", responsible: "", obs: "", file: null,
};

function statusFor(expiry: string | null) {
  if (!expiry) return { label: "SEM VENCIMENTO", color: "bg-gray-400", days: null as number | null, sortKey: 9999 };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const exp = new Date(expiry + "T00:00:00");
  const diff = Math.ceil((exp.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return { label: "VENCIDO", color: "bg-red-600", days: diff, sortKey: -10000 + diff };
  if (diff <= 30) return { label: "CRÍTICO", color: "bg-orange-500", days: diff, sortKey: diff };
  if (diff <= 90) return { label: "ATENÇÃO", color: "bg-yellow-500", days: diff, sortKey: diff };
  return { label: "VÁLIDO", color: "bg-green-600", days: diff, sortKey: diff };
}

export function DocumentosPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const canEdit = !!user;
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Doc | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  // Custom categories
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  const allCategories = useMemo(() => {
    const merged = [...DEFAULT_CATEGORIES];
    for (const c of customCategories) if (!merged.includes(c)) merged.push(c);
    return merged;
  }, [customCategories]);

  const loadCustomCategories = async () => {
    const { data } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "document_categories")
      .maybeSingle();
    if (data?.value && Array.isArray(data.value)) {
      setCustomCategories(data.value as string[]);
    }
  };

  const saveCustomCategory = async () => {
    const name = newCatName.trim();
    if (!name) return;
    if (allCategories.includes(name)) { toast.error("Categoria já existe"); return; }
    const updated = [...customCategories, name];
    const { error } = await supabase
      .from("system_settings")
      .upsert({ key: "document_categories", value: updated as any, updated_by: user?.id }, { onConflict: "key" });
    if (error) return toast.error(error.message);
    setCustomCategories(updated);
    setNewCatName("");
    toast.success("Categoria adicionada");
  };

  const removeCustomCategory = async (cat: string) => {
    const updated = customCategories.filter((c) => c !== cat);
    const { error } = await supabase
      .from("system_settings")
      .upsert({ key: "document_categories", value: updated as any, updated_by: user?.id }, { onConflict: "key" });
    if (error) return toast.error(error.message);
    setCustomCategories(updated);
    toast.success("Categoria removida");
  };

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("company_documents").select("*");
    if (error) toast.error("Erro ao carregar documentos");
    else setDocs((data ?? []) as Doc[]);
    setLoading(false);
  };

  const refreshAll = useCallback(async () => {
    await Promise.all([load(), loadCustomCategories()]);
  }, []);
  const { refresh, isRefreshing, lastRefreshAt } = useAutoRefresh(refreshAll);

  const sorted = [...docs].sort((a, b) => statusFor(a.expiry_date).sortKey - statusFor(b.expiry_date).sortKey);

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (d: Doc) => {
    setEditing(d);
    setForm({
      name: d.name, category: d.category, protocol_number: d.protocol_number ?? "",
      issue_date: d.issue_date ?? "", expiry_date: d.expiry_date ?? "",
      responsible: d.responsible ?? "", obs: d.obs ?? "", file: null,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error("Informe o nome do documento"); return; }
    setSaving(true);
    try {
      let file_url = editing?.file_url ?? null;
      if (form.file) {
        const path = `${Date.now()}_${form.file.name}`;
        const { error: upErr } = await supabase.storage
          .from("company-documents").upload(path, form.file);
        if (upErr) throw upErr;
        file_url = path;
      }
      const payload = {
        name: form.name.trim(),
        category: form.category,
        protocol_number: form.protocol_number || null,
        issue_date: form.issue_date || null,
        expiry_date: form.expiry_date || null,
        responsible: form.responsible || null,
        obs: form.obs || null,
        file_url,
      };
      if (editing) {
        const { error } = await supabase.from("company_documents").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Documento atualizado");
      } else {
        const { error } = await supabase.from("company_documents").insert({ ...payload, created_by: user?.id });
        if (error) throw error;
        toast.success("Documento criado");
      }
      setOpen(false); load();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally { setSaving(false); }
  };

  const remove = async (d: Doc) => {
    if (!confirm(`Excluir documento "${d.name}"?`)) return;
    const { error } = await supabase.from("company_documents").delete().eq("id", d.id);
    if (error) toast.error(error.message);
    else { toast.success("Documento excluído"); load(); }
  };

  const downloadFile = async (path: string) => {
    const { data, error } = await supabase.storage.from("company-documents").createSignedUrl(path, 60);
    if (error || !data) { toast.error("Erro ao baixar arquivo"); return; }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Documentos da Empresa</h1>
          <p className="text-sm text-muted-foreground">Controle de vencimentos com semáforo automático</p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton onRefresh={refresh} isRefreshing={isRefreshing} lastRefreshAt={lastRefreshAt} />
          {isAdmin && (
            <Button variant="outline" size="icon" onClick={() => setCatModalOpen(true)} title="Gerenciar categorias">
              <Settings className="h-4 w-4" />
            </Button>
          )}
          {isAdmin && (
            <Button onClick={openNew}><Plus className="w-4 h-4" /> Novo Documento</Button>
          )}
        </div>
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Status</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Nº/Protocolo</TableHead>
              <TableHead>Emissão</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Dias rest.</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead className="w-32 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
            ) : sorted.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhum documento cadastrado</TableCell></TableRow>
            ) : sorted.map((d) => {
              const s = statusFor(d.expiry_date);
              return (
                <TableRow key={d.id}>
                  <TableCell>
                    <Badge className={`${s.color} text-white hover:${s.color}`}>{s.label}</Badge>
                  </TableCell>
                  <TableCell className="font-medium flex items-center gap-2">
                    {d.file_url && <FileText className="w-4 h-4 text-muted-foreground" />}
                    {d.name}
                  </TableCell>
                  <TableCell className="text-sm">{d.category}</TableCell>
                  <TableCell className="text-sm">{d.protocol_number ?? "—"}</TableCell>
                  <TableCell className="text-sm">{d.issue_date ? new Date(d.issue_date + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</TableCell>
                  <TableCell className="text-sm">{d.expiry_date ? new Date(d.expiry_date + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</TableCell>
                  <TableCell className="text-sm">{s.days === null ? "—" : s.days < 0 ? `${Math.abs(s.days)} dias atrás` : `${s.days} dias`}</TableCell>
                  <TableCell className="text-sm">{d.responsible ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {d.file_url && (
                        <Button size="icon" variant="ghost" onClick={() => downloadFile(d.file_url!)}>
                          <Download className="w-4 h-4" />
                        </Button>
                      )}
                      {isAdmin && (
                        <>
                          <Button size="icon" variant="ghost" onClick={() => openEdit(d)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => remove(d)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Documento" : "Novo Documento"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Nome do documento *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {allCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Número/Protocolo</Label>
              <Input value={form.protocol_number} onChange={(e) => setForm({ ...form, protocol_number: e.target.value })} />
            </div>
            <div>
              <Label>Data de Emissão</Label>
              <Input type="date" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} />
            </div>
            <div>
              <Label>Data de Vencimento (opcional)</Label>
              <Input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} />
            </div>
            <div>
              <Label>Responsável</Label>
              <Input value={form.responsible} onChange={(e) => setForm({ ...form, responsible: e.target.value })} />
            </div>
            <div>
              <Label>Anexo (PDF)</Label>
              <Input type="file" accept="application/pdf" onChange={(e) => setForm({ ...form, file: e.target.files?.[0] ?? null })} />
            </div>
            <div className="col-span-2">
              <Label>Observação</Label>
              <Textarea value={form.obs} onChange={(e) => setForm({ ...form, obs: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Gerenciar Categorias */}
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
