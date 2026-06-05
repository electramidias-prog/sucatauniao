import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export type ExportFormat = 'txt' | 'csv' | 'xls' | 'pdf';

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportTable(
  format: ExportFormat,
  filenameBase: string,
  headers: string[],
  rows: (string | number)[][],
) {
  const safe = filenameBase.replace(/[^\w.-]+/g, '_');
  if (format === 'csv' || format === 'txt') {
    const sep = format === 'csv' ? ',' : '\t';
    const escape = (v: string | number) => {
      const s = String(v ?? '');
      if (format === 'csv' && /[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const text = [headers, ...rows].map(r => r.map(escape).join(sep)).join('\n');
    download(new Blob([text], { type: 'text/plain;charset=utf-8' }), `${safe}.${format}`);
    return;
  }
  if (format === 'xls') {
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Dados');
    const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    download(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${safe}.xlsx`);
    return;
  }
  if (format === 'pdf') {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(12);
    doc.text(filenameBase, 14, 14);
    autoTable(doc, {
      head: [headers],
      body: rows.map(r => r.map(c => String(c ?? ''))),
      startY: 20,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [220, 38, 38] },
    });
    doc.save(`${safe}.pdf`);
  }
}

import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Download } from 'lucide-react';
import React from 'react';

export function ExportButton({
  filenameBase,
  headers,
  rows,
  disabled,
}: {
  filenameBase: string;
  headers: string[];
  rows: (string | number)[][];
  disabled?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled} className="gap-1.5 h-8">
          <Download className="h-3.5 w-3.5" /> Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {(['txt', 'csv', 'xls', 'pdf'] as ExportFormat[]).map(f => (
          <DropdownMenuItem key={f} onClick={() => exportTable(f, filenameBase, headers, rows)}>
            {f.toUpperCase()}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}