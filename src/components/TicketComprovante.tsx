import React from 'react';

export interface TicketMaterial {
  material: string;
  bruto: number;
  tara: number;
  desconto: number;
  final: number;
  precoKg: number;
  subtotal: number;
}

export interface TicketDados {
  tipo: 'fornecedor' | 'paga';
  numero: string | number;
  clienteNome: string;
  clienteDoc?: string | null;
  placa?: string | null;
  dataHora: string; // ISO
  fotoUrl?: string | null;
  // fornecedor
  materiais?: TicketMaterial[];
  totalKg?: number;
  totalValor?: number;
  // paga
  pesoEntrada?: number;
  pesoSaida?: number;
  pesoLiquido?: number;
  tarifa?: number;
  tarifaOrigem?: 'global' | 'customizada' | null;
  pagamento?: 'pago' | 'nao_pago';
}

const fmtKg = (n: number | null | undefined) =>
  `${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`;
const fmtBRL = (n: number | null | undefined) =>
  (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDT = (s: string) => new Date(s).toLocaleString('pt-BR');

const cell: React.CSSProperties = { padding: '2px 4px', borderBottom: '1px dashed #999', fontSize: 11 };
const th: React.CSSProperties = { ...cell, fontWeight: 700, borderBottom: '1px solid #000' };

export const TICKET_DOM_ID = 'ticket-comprovante';

export function TicketComprovante({ dados }: { dados: TicketDados }) {
  const isFornec = dados.tipo === 'fornecedor';
  return (
    <div
      id={TICKET_DOM_ID}
      style={{
        width: 400,
        background: '#fff',
        color: '#000',
        padding: 16,
        fontFamily: '"Courier New", monospace',
        fontSize: 12,
        lineHeight: 1.35,
        boxSizing: 'border-box',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: 1 }}>SUCATA UNIÃO</div>
        <div style={{ fontSize: 10 }}>CNPJ 49.520.286/0001-25</div>
        <div style={{ fontSize: 10 }}>Santa Luzia — MG</div>
      </div>
      <hr style={{ border: 0, borderTop: '1px solid #000', margin: '6px 0' }} />
      <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 13 }}>
        {isFornec ? 'PESAGEM FORNECEDOR' : 'PESAGEM PAGA'}
      </div>
      <div style={{ fontSize: 11, marginTop: 4 }}>
        <div><strong>Ticket:</strong> #{String(dados.numero)}</div>
        <div><strong>Cliente:</strong> {dados.clienteNome || '—'}</div>
        {dados.clienteDoc && <div><strong>CPF/CNPJ:</strong> {dados.clienteDoc}</div>}
        <div><strong>Placa:</strong> {dados.placa || '—'}</div>
        <div><strong>Data:</strong> {fmtDT(dados.dataHora)}</div>
      </div>
      <hr style={{ border: 0, borderTop: '1px dashed #000', margin: '6px 0' }} />

      {isFornec ? (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
            <thead>
              <tr>
                <th style={th}>Mat.</th>
                <th style={{ ...th, textAlign: 'right' }}>Bruto</th>
                <th style={{ ...th, textAlign: 'right' }}>Tara</th>
                <th style={{ ...th, textAlign: 'right' }}>Desc</th>
                <th style={{ ...th, textAlign: 'right' }}>Final</th>
                <th style={{ ...th, textAlign: 'right' }}>R$/kg</th>
                <th style={{ ...th, textAlign: 'right' }}>Subt.</th>
              </tr>
            </thead>
            <tbody>
              {(dados.materiais || []).map((m, i) => (
                <tr key={i}>
                  <td style={cell}>{m.material}</td>
                  <td style={{ ...cell, textAlign: 'right' }}>{m.bruto.toFixed(2)}</td>
                  <td style={{ ...cell, textAlign: 'right' }}>{m.tara.toFixed(2)}</td>
                  <td style={{ ...cell, textAlign: 'right' }}>{m.desconto.toFixed(2)}</td>
                  <td style={{ ...cell, textAlign: 'right' }}>{m.final.toFixed(2)}</td>
                  <td style={{ ...cell, textAlign: 'right' }}>{m.precoKg.toFixed(2)}</td>
                  <td style={{ ...cell, textAlign: 'right' }}>{m.subtotal.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
            <span>TOTAL LÍQUIDO:</span><span>{fmtKg(dados.totalKg)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 14 }}>
            <span>VALOR TOTAL:</span><span>{fmtBRL(dados.totalValor)}</span>
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Peso de entrada:</span><span>{fmtKg(dados.pesoEntrada)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Peso de saída:</span><span>{fmtKg(dados.pesoSaida)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
            <span>Peso líquido:</span><span>{fmtKg(dados.pesoLiquido)}</span>
          </div>
          <hr style={{ border: 0, borderTop: '1px dashed #000', margin: '6px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Tarifa aplicada:</span><span>{fmtBRL(dados.tarifa)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
            <span>Origem da tarifa:</span>
            <span>{dados.tarifaOrigem === 'customizada' ? 'Personalizada' : 'Padrão'}</span>
          </div>
          <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 14 }}>
            <span>TOTAL:</span><span>{fmtBRL(dados.tarifa)}</span>
          </div>
          {dados.pagamento && (
            <div style={{ marginTop: 4, textAlign: 'center', fontWeight: 700 }}>
              Pagamento: {dados.pagamento === 'pago' ? 'PAGO' : 'NÃO PAGO'}
            </div>
          )}
        </>
      )}

      {dados.fotoUrl && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 10, marginBottom: 2 }}>Foto da carga:</div>
          <img
            src={dados.fotoUrl}
            crossOrigin="anonymous"
            alt=""
            style={{ width: '100%', maxHeight: 260, objectFit: 'contain', border: '1px solid #000' }}
          />
        </div>
      )}

      <hr style={{ border: 0, borderTop: '1px solid #000', margin: '8px 0 4px' }} />
      <div style={{ textAlign: 'center', fontSize: 9 }}>
        Comprovante gerado automaticamente — Sucata União
      </div>
    </div>
  );
}