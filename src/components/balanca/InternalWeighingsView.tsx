import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Truck } from 'lucide-react';
import { ExportButton } from './exportTable';

interface Row {
  id: string;
  vehicle_plate: string;
  destination: string | null;
  entry_at: string;
  exit_at: string | null;
  net_weight: number | null;
  employees?: { full_name: string } | null;
}

const fmtKg = (n: number | null | undefined) =>
  `${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg`;
const fmtDT = (s: string) => new Date(s).toLocaleString('pt-BR');

export function InternalWeighingsView() {
  const [rows, setRows] = useState<Row[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('internal_weighings')
      .select('id,vehicle_plate,destination,entry_at,exit_at,net_weight,employees(full_name)')
      .eq('status', 'finalizado')
      .order('entry_at', { ascending: false })
      .limit(200);
    setRows(((data as any) || []) as Row[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  const headers = ['Data', 'Motorista', 'Placa', 'Destino', 'Saída', 'Líquido (kg)'];
  const exportRows = rows.map(r => [
    new Date(r.entry_at).toLocaleDateString('pt-BR'),
    r.employees?.full_name ?? '-',
    r.vehicle_plate,
    r.destination ?? '-',
    r.exit_at ? fmtDT(r.exit_at) : '-',
    Number(r.net_weight || 0).toFixed(3),
  ]);

  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Truck className="h-4 w-4" /> Pesagens Internas (consulta)
          </h3>
          <ExportButton filenameBase="pesagens-internas" headers={headers} rows={exportRows} disabled={rows.length === 0} />
        </div>
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma pesagem interna finalizada.</p>
        ) : (
          <div className="overflow-x-auto max-h-80">
            <Table>
              <TableHeader>
                <TableRow>{headers.map(h => <TableHead key={h} className="text-xs">{h}</TableHead>)}</TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs py-1.5">{new Date(r.entry_at).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell className="text-[13px] py-1.5">{r.employees?.full_name ?? '-'}</TableCell>
                    <TableCell className="text-[13px] py-1.5">{r.vehicle_plate}</TableCell>
                    <TableCell className="text-[13px] py-1.5">{r.destination ?? '-'}</TableCell>
                    <TableCell className="text-xs py-1.5">{r.exit_at ? fmtDT(r.exit_at) : '-'}</TableCell>
                    <TableCell className="text-xs py-1.5 text-right font-semibold">{fmtKg(r.net_weight)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}