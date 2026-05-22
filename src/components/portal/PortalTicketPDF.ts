import jsPDF from 'jspdf'

interface ClientInfo {
  name?: string | null
  document_number?: string | null
  document_type?: string | null
  vehicle_plate?: string | null
}
interface Weighing {
  ticket_number: number
  vehicle_plate?: string | null
  created_at: string
  status: string
  final_net_weight?: number | null
  net_weight?: number | null
  total_value?: number | null
  material_type?: string | null
  gross_weight?: number
  tare_weight?: number
  price_per_kg?: number
}
interface Fraction {
  sequence_number: number
  material_type: string
  previous_weight: number
  current_tare: number
  net_weight: number
  final_weight: number
  price_per_kg: number
  subtotal: number
}

const fmtBR = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDoc = (d?: string | null, t?: string | null) => {
  if (!d) return '—'
  if (t === 'cnpj') return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

export function generateTicketPDF(opts: { weighing: Weighing; fractions: Fraction[]; client: ClientInfo }) {
  const { weighing: w, fractions, client } = opts
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  let y = 14

  doc.setFillColor(220, 38, 38)
  doc.rect(0, 0, W, 18, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold').setFontSize(14)
  doc.text('SUCATA UNIÃO', 14, 11)
  doc.setFont('helvetica', 'normal').setFontSize(9)
  doc.text('Comprovante de Pesagem', W - 14, 11, { align: 'right' })

  y = 26
  doc.setTextColor(0, 0, 0).setFontSize(9)
  doc.text('CNPJ: 49.520.286/0001-25', 14, y)
  doc.text(`Ticket Nº ${w.ticket_number}`, W - 14, y, { align: 'right' })
  y += 5
  doc.text(`Emitido em: ${new Date(w.created_at).toLocaleString('pt-BR')}`, 14, y)
  doc.text(`Status: ${w.status}`, W - 14, y, { align: 'right' })

  y += 8
  doc.setDrawColor(200).line(14, y, W - 14, y); y += 6
  doc.setFont('helvetica', 'bold').text('Cliente', 14, y); y += 5
  doc.setFont('helvetica', 'normal')
  doc.text(`Nome: ${client.name ?? '—'}`, 14, y); y += 5
  doc.text(`Documento: ${fmtDoc(client.document_number, client.document_type)}`, 14, y); y += 5
  doc.text(`Placa: ${w.vehicle_plate ?? client.vehicle_plate ?? '—'}`, 14, y); y += 7

  doc.setFont('helvetica', 'bold').text('Materiais', 14, y); y += 4
  const rows: (string | number)[][] = []
  if (fractions.length > 0) {
    fractions.forEach(f => {
      rows.push([
        `#${f.sequence_number}`,
        f.material_type,
        fmtBR(Number(f.previous_weight || 0)),
        fmtBR(Number(f.current_tare || 0)),
        fmtBR(Number(f.final_weight || f.net_weight || 0)),
        `R$ ${fmtBR(Number(f.price_per_kg || 0))}`,
        `R$ ${fmtBR(Number(f.subtotal || 0))}`,
      ])
    })
  } else {
    rows.push([
      '#1',
      w.material_type ?? '—',
      fmtBR(Number(w.gross_weight || 0)),
      fmtBR(Number(w.tare_weight || 0)),
      fmtBR(Number(w.final_net_weight || w.net_weight || 0)),
      `R$ ${fmtBR(Number(w.price_per_kg || 0))}`,
      `R$ ${fmtBR(Number(w.total_value || 0))}`,
    ])
  }

  const cols = ['#', 'Material', 'Bruto (kg)', 'Tara (kg)', 'Líquido (kg)', 'Preço/kg', 'Subtotal']
  const colX = [14, 24, 64, 90, 116, 142, 170]
  doc.setFontSize(8).setFont('helvetica', 'bold')
  cols.forEach((c, i) => doc.text(c, colX[i], y + 5))
  y += 7
  doc.setFont('helvetica', 'normal')
  rows.forEach(r => {
    r.forEach((cell, i) => doc.text(String(cell), colX[i], y))
    y += 5
  })

  y += 4
  doc.setDrawColor(200).line(14, y, W - 14, y); y += 6
  const totalKg = fractions.reduce((a, f) => a + Number(f.final_weight || f.net_weight || 0), 0) || Number(w.final_net_weight || w.net_weight || 0)
  const totalRs = fractions.reduce((a, f) => a + Number(f.subtotal || 0), 0) || Number(w.total_value || 0)
  doc.setFont('helvetica', 'bold').setFontSize(10)
  doc.text(`Peso Líquido Total: ${fmtBR(totalKg)} kg`, 14, y)
  doc.text(`Total: R$ ${fmtBR(totalRs)}`, W - 14, y, { align: 'right' })

  doc.setFont('helvetica', 'italic').setFontSize(8).setTextColor(120)
  doc.text('Documento emitido pelo Portal do Fornecedor — Sucata União', W / 2, 285, { align: 'center' })

  const dt = new Date(w.created_at).toISOString().slice(0, 10)
  doc.save(`ticket-${w.ticket_number}-${dt}.pdf`)
}