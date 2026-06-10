export interface ReceiptData {
  ticketId: string;
  type: 'avulsa' | 'cadastrada';
  clientName?: string;
  clientDocument?: string;
  vehiclePlate: string;
  entryAt: string;
  grossWeight: number;
  tareWeight?: number | null;
  netWeight?: number | null;
  tarifa?: number | null;
  tarifaOrigem?: 'global' | 'customizada' | null;
  totalAmount?: number | null;
  paymentStatus?: 'pago' | 'nao_pago';
  finalized?: boolean;
}

const fmtKg = (n: number | null | undefined) =>
  `${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg`;
const fmtBRL = (n: number | null | undefined) =>
  (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDT = (s: string) => new Date(s).toLocaleString('pt-BR');

export function printReceipt(d: ReceiptData) {
  const w = window.open('', '_blank', 'width=320,height=600');
  if (!w) return;
  const sep = '--------------------------------';
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Ticket ${d.ticketId.slice(0, 8)}</title>
  <style>
    @page { size: 80mm auto; margin: 0 }
    body { font-family: 'Courier New', monospace; font-size: 11px; color: #000; margin: 0; padding: 4mm; width: 72mm; }
    .c { text-align: center; }
    .b { font-weight: bold; }
    .row { display: flex; justify-content: space-between; }
    hr { border: none; border-top: 1px dashed #000; margin: 4px 0; }
  </style></head><body>
    <div class="c b">SUCATA UNIÃO</div>
    <div class="c">CNPJ 49.520.286/0001-25</div>
    <hr/>
    <div class="c b">${d.type === 'avulsa' ? 'PESAGEM AVULSA' : 'PESAGEM CADASTRADA'}</div>
    <div>Ticket: ${d.ticketId.slice(0, 8).toUpperCase()}</div>
    <div>Cliente: ${d.clientName ?? '-'}</div>
    ${d.clientDocument ? `<div>Doc: ${d.clientDocument}</div>` : ''}
    <div>Placa: ${d.vehiclePlate}</div>
    <div>Entrada: ${fmtDT(d.entryAt)}</div>
    <hr/>
    <div class="row"><span>Peso Entrada:</span><span>${fmtKg(d.grossWeight)}</span></div>
    ${d.finalized ? `
      <div class="row"><span>Tara:</span><span>${fmtKg(d.tareWeight)}</span></div>
      <div class="row b"><span>Líquido:</span><span>${fmtKg(d.netWeight)}</span></div>
      <div class="row"><span>Tarifa ciclo:</span><span>${fmtBRL(d.tarifa)}${d.tarifaOrigem ? ` (${d.tarifaOrigem === 'customizada' ? 'pers.' : 'padrão'})` : ''}</span></div>
      <div class="row b"><span>TOTAL:</span><span>${fmtBRL(d.totalAmount)}</span></div>
    ` : ''}
    <hr/>
    <div>Pagamento: ${d.paymentStatus === 'pago' ? 'PAGO' : 'NÃO PAGO'}</div>
    <hr/>
    <div class="c">Sucata União — Santa Luzia/MG</div>
    <div class="c" style="margin-top:4mm">${sep}</div>
    <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),300);};</script>
  </body></html>`;
  w.document.write(html);
  w.document.close();
}