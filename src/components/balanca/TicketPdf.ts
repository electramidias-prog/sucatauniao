import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const MATERIAL_LABELS: Record<string, string> = {
  mista: 'Sucata Mista', pesada: 'Sucata Pesada', limaria: 'Limaria/Limalha',
  fundido: 'Ferro Fundido', amortecedor: 'Amortecedor', aluminio: 'Alumínio',
  cobre: 'Cobre', inox: 'Inox', latao: 'Latão', bateria: 'Bateria',
  papelao: 'Papelão', plastico: 'Plástico', outro: 'Outro',
};
const matLabel = (v: string | null | undefined) => (!v ? '—' : MATERIAL_LABELS[v] || v);
const fmtKg = (n: number) => `${Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtBRL = (n: number) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export interface TicketPdfFraction {
  material_type: string;
  previous_weight: number;
  current_tare: number;
  net_weight: number;
  final_weight: number;
  price_per_kg: number;
  subtotal: number;
}

export interface TicketPdfData {
  ticket_number: number;
  closed_at: string;
  client_name: string;
  client_document: string;
  vehicle_plate: string | null;
  fractions: TicketPdfFraction[];
  photo_url?: string | null;
}

async function loadImageAsDataUrl(url: string): Promise<{ dataUrl: string; w: number; h: number; type: 'PNG' | 'JPEG' } | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const dataUrl: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    const img: HTMLImageElement = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = dataUrl;
    });
    const type: 'PNG' | 'JPEG' = blob.type.includes('png') ? 'PNG' : 'JPEG';
    return { dataUrl, w: img.naturalWidth, h: img.naturalHeight, type };
  } catch {
    return null;
  }
}

export async function buildTicketPdf(data: TicketPdfData): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 15;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('SUCATA UNIÃO', pageW / 2, y, { align: 'center' });
  y += 6;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('CNPJ: 49.520.286/0001-25', pageW / 2, y, { align: 'center' });
  y += 4;
  doc.text('Santa Luzia — MG', pageW / 2, y, { align: 'center' });
  y += 4;
  doc.setLineWidth(0.3);
  doc.line(15, y, pageW - 15, y);
  y += 6;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Ticket Nº: #${data.ticket_number}`, 15, y);
  doc.setFont('helvetica', 'normal');
  doc.text(new Date(data.closed_at).toLocaleString('pt-BR'), pageW - 15, y, { align: 'right' });
  y += 5;
  doc.text(`Cliente: ${data.client_name}`, 15, y); y += 4;
  doc.text(`CPF/CNPJ: ${data.client_document || '—'}`, 15, y); y += 4;
  doc.text(`Placa: ${data.vehicle_plate || '—'}`, 15, y); y += 4;

  const head = [['Material', 'Bruto (kg)', 'Tara (kg)', 'Desc. (kg)', 'Final (kg)', 'R$/kg', 'Subtotal']];
  const body = data.fractions.map((f) => {
    const discount = Math.max(0, Number(f.net_weight || 0) - Number(f.final_weight || 0));
    return [
      matLabel(f.material_type),
      fmtKg(f.previous_weight),
      fmtKg(f.current_tare),
      fmtKg(discount),
      fmtKg(f.final_weight),
      fmtBRL(f.price_per_kg),
      fmtBRL(f.subtotal),
    ];
  });

  autoTable(doc, {
    startY: y + 2,
    head,
    body,
    styles: { fontSize: 9, cellPadding: 1.5 },
    headStyles: { fillColor: [180, 30, 30], textColor: 255, halign: 'center' },
    columnStyles: {
      1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' },
      4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' },
    },
    margin: { left: 15, right: 15 },
  });

  const finalY = (doc as any).lastAutoTable?.finalY ?? y + 30;
  const totalKg = data.fractions.reduce((s, f) => s + Number(f.final_weight || 0), 0);
  const totalValue = data.fractions.reduce((s, f) => s + Number(f.subtotal || 0), 0);

  let yT = finalY + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`Total Peso Líquido: ${fmtKg(totalKg)} kg`, pageW - 15, yT, { align: 'right' });
  yT += 6;
  doc.setFontSize(13);
  doc.text(`Total a Receber: ${fmtBRL(totalValue)}`, pageW - 15, yT, { align: 'right' });
  yT += 8;

  if (data.photo_url) {
    const img = await loadImageAsDataUrl(data.photo_url);
    if (img) {
      const maxW = pageW - 30;
      const maxH = 80;
      const ratio = img.w / img.h;
      let w = maxW; let h = w / ratio;
      if (h > maxH) { h = maxH; w = h * ratio; }
      const pageH = doc.internal.pageSize.getHeight();
      if (yT + h > pageH - 25) {
        doc.addPage();
        yT = 20;
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text('Foto da carga:', 15, yT);
      yT += 3;
      doc.addImage(img.dataUrl, img.type, 15, yT, w, h);
      yT += h + 4;
    }
  }

  const pageH = doc.internal.pageSize.getHeight();
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text('Comprovante gerado automaticamente — Sucata União', pageW / 2, pageH - 12, { align: 'center' });
  doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, pageW / 2, pageH - 8, { align: 'center' });

  return doc;
}

export function buildWhatsappMessage(data: TicketPdfData): string {
  const totalKg = data.fractions.reduce((s, f) => s + Number(f.final_weight || 0), 0);
  const totalValue = data.fractions.reduce((s, f) => s + Number(f.subtotal || 0), 0);
  const lines = data.fractions
    .map((f) => `- ${matLabel(f.material_type)}: ${fmtKg(f.final_weight)}kg × R$${Number(f.price_per_kg).toFixed(2)} = ${fmtBRL(f.subtotal)}`)
    .join('\n');
  return `Olá ${data.client_name}! 👋

Segue o resumo da sua pesagem na *Sucata União*:

🎫 *Ticket:* #${data.ticket_number}
📅 *Data:* ${new Date(data.closed_at).toLocaleString('pt-BR')}
🚛 *Placa:* ${data.vehicle_plate || '—'}

📦 *Materiais:*
${lines}

💰 *Total a receber:* ${fmtBRL(totalValue)} (${fmtKg(totalKg)} kg)

O comprovante completo em PDF foi baixado automaticamente.

Qualquer dúvida estamos à disposição!

_Sucata União — Santa Luzia/MG_`;
}

export function ticketPdfFilename(data: TicketPdfData): string {
  const d = new Date(data.closed_at);
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `ticket-${data.ticket_number}-${stamp}.pdf`;
}