import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calculator, Plus, Trash2, FileText } from 'lucide-react';

interface MTRItem {
  id: string;
  residuo: string;
  classe: string;
  estado_fisico: string;
  peso_kg: number;
  unidade: string;
  acondicionamento: string;
}

const RESIDUOS = [
  'Sucata de ferro/aço', 'Sucata de cobre', 'Sucata de alumínio',
  'Sucata mista de metais', 'Sucata de inox', 'Resíduo eletrônico',
  'Baterias/Acumuladores', 'Óleo usado', 'Pneus usados', 'Outros',
];

const CLASSES = ['Classe I - Perigoso', 'Classe II-A - Não Inerte', 'Classe II-B - Inerte'];
const ESTADOS = ['Sólido', 'Líquido', 'Gasoso', 'Pastoso'];
const ACONDICIONAMENTOS = ['Granel', 'Caçamba', 'Big Bag', 'Tambor', 'Container', 'Fardo', 'Outro'];

const money = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function CalculadoraMTRPage() {
  const [items, setItems] = useState<MTRItem[]>([]);
  const [gerador, setGerador] = useState({ nome: '', cnpj: '', endereco: '' });
  const [transportador, setTransportador] = useState({ nome: '', cnpj: '', placa: '' });
  const [destinador, setDestinador] = useState({ nome: '', cnpj: '' });

  const addItem = () => {
    setItems(prev => [...prev, {
      id: crypto.randomUUID(),
      residuo: RESIDUOS[0],
      classe: CLASSES[2],
      estado_fisico: ESTADOS[0],
      peso_kg: 0,
      unidade: 'kg',
      acondicionamento: ACONDICIONAMENTOS[0],
    }]);
  };

  const updateItem = (id: string, field: string, value: string | number) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const removeItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id));

  const totalWeight = items.reduce((s, i) => s + i.peso_kg, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Calculadora MTR</h1>
          <p className="text-sm text-muted-foreground">Manifesto de Transporte de Resíduos</p>
        </div>
        <Button variant="outline" size="sm" disabled>
          <FileText className="h-3.5 w-3.5 mr-1" /> Gerar PDF
        </Button>
      </div>

      {/* Gerador / Transportador / Destinador */}
      <div className="grid lg:grid-cols-3 gap-3">
        <Card><CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-primary">Gerador</h3>
          <div><Label className="text-xs">Razão Social</Label><Input value={gerador.nome} onChange={e => setGerador(p => ({ ...p, nome: e.target.value }))} className="h-8 text-xs" /></div>
          <div><Label className="text-xs">CNPJ</Label><Input value={gerador.cnpj} onChange={e => setGerador(p => ({ ...p, cnpj: e.target.value }))} className="h-8 text-xs" /></div>
          <div><Label className="text-xs">Endereço</Label><Input value={gerador.endereco} onChange={e => setGerador(p => ({ ...p, endereco: e.target.value }))} className="h-8 text-xs" /></div>
        </CardContent></Card>

        <Card><CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-primary">Transportador</h3>
          <div><Label className="text-xs">Razão Social</Label><Input value={transportador.nome} onChange={e => setTransportador(p => ({ ...p, nome: e.target.value }))} className="h-8 text-xs" /></div>
          <div><Label className="text-xs">CNPJ</Label><Input value={transportador.cnpj} onChange={e => setTransportador(p => ({ ...p, cnpj: e.target.value }))} className="h-8 text-xs" /></div>
          <div><Label className="text-xs">Placa</Label><Input value={transportador.placa} onChange={e => setTransportador(p => ({ ...p, placa: e.target.value }))} className="h-8 text-xs" /></div>
        </CardContent></Card>

        <Card><CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-primary">Destinador</h3>
          <div><Label className="text-xs">Razão Social</Label><Input value={destinador.nome} onChange={e => setDestinador(p => ({ ...p, nome: e.target.value }))} className="h-8 text-xs" /></div>
          <div><Label className="text-xs">CNPJ</Label><Input value={destinador.cnpj} onChange={e => setDestinador(p => ({ ...p, cnpj: e.target.value }))} className="h-8 text-xs" /></div>
        </CardContent></Card>
      </div>

      {/* Resíduos */}
      <Card><CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-primary">Resíduos ({items.length})</h3>
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold">Total: {totalWeight.toFixed(1)} kg ({(totalWeight / 1000).toFixed(2)}t)</span>
            <Button size="sm" onClick={addItem}><Plus className="h-3.5 w-3.5 mr-1" /> Adicionar</Button>
          </div>
        </div>

        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">Clique em "Adicionar" para incluir resíduos no manifesto</p>
        ) : (
          <div className="space-y-3">
            {items.map((item, idx) => (
              <div key={item.id} className="border rounded p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Resíduo #{idx + 1}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeItem(item.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                  <div>
                    <Label className="text-xs">Tipo</Label>
                    <Select value={item.residuo} onValueChange={v => updateItem(item.id, 'residuo', v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{RESIDUOS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Classe</Label>
                    <Select value={item.classe} onValueChange={v => updateItem(item.id, 'classe', v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{CLASSES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Estado Físico</Label>
                    <Select value={item.estado_fisico} onValueChange={v => updateItem(item.id, 'estado_fisico', v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{ESTADOS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Acondicionamento</Label>
                    <Select value={item.acondicionamento} onValueChange={v => updateItem(item.id, 'acondicionamento', v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{ACONDICIONAMENTOS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Peso (kg)</Label>
                    <Input type="number" value={item.peso_kg || ''} onChange={e => updateItem(item.id, 'peso_kg', parseFloat(e.target.value) || 0)} className="h-8 text-xs" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent></Card>
    </div>
  );
}
