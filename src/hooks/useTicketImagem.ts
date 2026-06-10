import html2canvas from 'html2canvas';
import { createRoot } from 'react-dom/client';
import React from 'react';
import { TicketComprovante, TICKET_DOM_ID, type TicketDados } from '@/components/TicketComprovante';
import { logAudit } from '@/components/balanca/auditLog';

function nomeArquivo(dados: TicketDados) {
  const d = new Date(dados.dataHora);
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `ticket-${dados.numero}-${stamp}.png`;
}

async function renderEAndCapture(dados: TicketDados): Promise<HTMLCanvasElement> {
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-99999px';
  host.style.top = '0';
  host.style.zIndex = '-1';
  document.body.appendChild(host);

  const root = createRoot(host);
  await new Promise<void>((resolve) => {
    root.render(React.createElement(TicketComprovante, { dados }));
    // wait a tick for layout
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

  // Aguarda imagem da foto carregar (se houver)
  const target = host.querySelector(`#${TICKET_DOM_ID}`) as HTMLElement | null;
  if (target) {
    const imgs = Array.from(target.querySelectorAll('img'));
    await Promise.all(
      imgs.map(
        (img) =>
          new Promise<void>((res) => {
            if (img.complete && img.naturalWidth > 0) return res();
            img.onload = () => res();
            img.onerror = () => res();
            setTimeout(() => res(), 4000);
          }),
      ),
    );
  }

  try {
    const canvas = await html2canvas(target || host, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      allowTaint: false,
      logging: false,
    });
    return canvas;
  } finally {
    setTimeout(() => {
      try { root.unmount(); } catch { /* noop */ }
      host.remove();
    }, 0);
  }
}

export async function gerarTicketPNG(dados: TicketDados): Promise<{ blob: Blob; url: string; nomeArquivo: string }> {
  const canvas = await renderEAndCapture(dados);
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao gerar PNG'))), 'image/png'),
  );
  const url = URL.createObjectURL(blob);
  return { blob, url, nomeArquivo: nomeArquivo(dados) };
}

export async function baixarTicketPNG(dados: TicketDados, opts?: { auditTable?: string; auditRecordId?: string }) {
  const { url, nomeArquivo: name } = await gerarTicketPNG(dados);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  if (opts?.auditTable && opts.auditRecordId) {
    await logAudit({
      table: opts.auditTable,
      recordId: opts.auditRecordId,
      action: 'UPDATE',
      newValue: { audit_action: 'TICKET_PNG_GERADO', nomeArquivo: name },
    });
  }
}

export async function imprimirTicket(dados: TicketDados) {
  const { url } = await gerarTicketPNG(dados);
  const w = window.open('', '_blank', 'width=420,height=720');
  if (!w) {
    // Pop-up bloqueado — abre em nova aba
    window.open(url, '_blank');
    return;
  }
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Ticket ${dados.numero}</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    html, body { margin: 0; padding: 0; background: #fff; }
    @media print { body { margin: 0; } img { width: 80mm; display: block; } }
    body { display: flex; justify-content: center; }
    img { width: 80mm; display: block; }
  </style></head><body>
    <img src="${url}" alt="Ticket" onload="setTimeout(()=>{window.focus();window.print();},150)"/>
  </body></html>`);
  w.document.close();
}

export function montarMensagemWhatsappPaga(dados: {
  numero: string | number;
  clienteNome: string;
  dataHora: string;
  placa?: string | null;
  pesoLiquido: number;
  tarifa: number;
}) {
  const data = new Date(dados.dataHora).toLocaleString('pt-BR');
  const peso = `${dados.pesoLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`;
  const tar = dados.tarifa.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `Olá ${dados.clienteNome}! 👋

Segue seu comprovante de pesagem na *Sucata União*:

🎫 *Ticket:* #${dados.numero}
📅 *Data:* ${data}
🚛 *Placa:* ${dados.placa || '—'}
⚖️ *Peso líquido:* ${peso}
💰 *Tarifa:* R$ ${tar}

O comprovante em imagem foi enviado separadamente.
Qualquer dúvida estamos à disposição!

_Sucata União — Santa Luzia/MG_`;
}