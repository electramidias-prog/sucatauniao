## Expansão do módulo /balanca — 3 abas

Mantém a tela atual como Aba 1 "Fornecedores" (intocada) e adiciona Aba 2 (Pesagens Pagas) e Aba 3 (Pesagens Internas) dentro da mesma rota.

### 1. Migração SQL (uma única migração)

Tabelas novas em `public`:
- `paid_weighings` — tickets pagos (avulsa/cadastrada), com `net_weight` gerada, status, payment_status, vínculo opcional a `clients` e `invoices`.
- `paid_weighing_reopenings` — histórico de reaberturas com motivo.
- `client_default_tares` — tara padrão por cliente (única por cliente).
- `internal_weighings` — pesagens de motoristas internos (FK em `employees`), sem pagamento, sem cupom.

Cada `CREATE TABLE` seguido de:
```
GRANT SELECT, INSERT, UPDATE, DELETE ON public.<t> TO authenticated;
GRANT ALL ON public.<t> TO service_role;
ALTER TABLE ... ENABLE ROW LEVEL SECURITY;
```

Políticas RLS por papel (usando `has_role`):
- `paid_weighings`, `client_default_tares`: admin, operador_balanca, financeiro (ALL com policies separadas SELECT/INSERT/UPDATE; DELETE só admin).
- `paid_weighing_reopenings`: admin, operador_balanca (SELECT/INSERT).
- `internal_weighings`: admin, operador_balanca, financeiro, conferente (SELECT/INSERT/UPDATE; DELETE só admin).
- Operadores não podem deletar tickets finalizados (policy DELETE restrita a admin + status check).

Trigger `updated_at` em `paid_weighings` e `internal_weighings`.

Encerramento automático: agendar via `cron.schedule` (pg_cron) executando a cada 15 min UPDATE em `paid_weighings` onde `type='avulsa'` AND `status='em_aberto'` AND `entry_at < now() - interval '24 hours'` → `status='encerrado_automatico'`. Se `pg_cron` não estiver habilitado, habilitar via `CREATE EXTENSION IF NOT EXISTS pg_cron`.

Observação: o spec usa `cpf_cnpj`, mas a tabela `clients` existente usa `document_number` — a busca usará `document_number`. O spec usa `profiles(id)` para `operator_id`; usaremos `auth.users(id)` referenciado por `user_id` consistente com o restante do projeto (campo `operator_id uuid not null default auth.uid()`).

### 2. Estrutura de abas

Em `src/components/BalancaPage.tsx`: envolver o JSX atual em um `<Tabs>` (shadcn) com 3 `TabsTrigger` ("Fornecedores", "Pesagens Pagas", "Pesagens Internas"). A Aba 1 mantém 100% do conteúdo atual sem refator. Abas 2 e 3 renderizam componentes lazy.

### 3. Novos componentes

- `src/components/PesagensPagasTab.tsx` — sub-abas Avulsa/Cadastrada + card de caixa do dia no topo + realtime subscription em `paid_weighings`.
- `src/components/PesagensInternasTab.tsx` — formulário + tabela aberta + finalizada com filtros.
- `src/components/balanca/ClientSearchInline.tsx` — componente compartilhado de busca/cadastro rápido de cliente.
- `src/components/balanca/ReopenTicketDialog.tsx` — modal de motivo de reabertura (radio + textarea condicional + audit log).
- `src/components/balanca/ThermalReceipt.tsx` — markup oculto + estilos `@media print` 80mm + função `printReceipt(ticket)`.
- `src/components/balanca/DefaultTareDialog.tsx` — modal de configurar tara padrão.
- `src/components/balanca/GenerateInvoiceDialog.tsx` — seletor de período + criação de invoice + items + link nas pesagens.

### 4. Aba 2 — Pesagens Pagas

Card fixo no topo (Caixa do Dia) com: total pesagens, quitadas, valor quitado (R$), inadimplente (R$). Realtime subscribe via `supabase.channel('paid_weighings_today')`.

Sub-aba **Avulsa**:
- Form: cliente (search inline), placa (uppercase), peso entrada, preço/kg → "Registrar Entrada" → INSERT + emite cupom.
- Tabela em aberto com coluna "Tempo Aberto" (timer client-side, fundo vermelho >20h), botões Pagar / Registrar Saída / Reabrir.
- Seção separada "Encerrados automaticamente" com badge vermelho.
- Tabela "Finalizados do dia" com exportação TXT/CSV/XLS/PDF.

Sub-aba **Cadastrada**:
- Painel de empresas (clients com pesagens cadastradas OU tara padrão).
- Botão "Nova Pesagem" pré-seleciona cliente, carrega tara padrão se houver (editável).
- Botão "Configurar Tara Padrão" → upsert em `client_default_tares`.
- Botão "Gerar Faturamento do Período" → modal com período → lista pesagens pagas + finalizadas → cria `invoices` + `invoice_items` + atualiza `paid_weighings.invoice_id` → PDF via jsPDF (reusar utilitário do FaturamentoPage). Aparece automaticamente em `/faturamento`.
- Tabela finalizadas com exportação.

Modal de **Reabertura**: RadioGroup com 4 motivos; se "outro", textarea obrigatória; confirmar desabilita até resposta; ao OK: UPDATE status='reaberto' + INSERT em `paid_weighing_reopenings` + INSERT em `audit_logs` (`new_value` com reason/reason_text, IP via header se disponível).

### 5. Aba 3 — Pesagens Internas

Formulário:
- Motorista: combobox buscando em `employees` (filtra por nome).
- Placa: combobox de placas distintas existentes (`weighings.vehicle_plate` UNION `internal_weighings.vehicle_plate`) + permite digitar nova.
- Peso entrada, destino (texto), observações.
- "Registrar Entrada" → INSERT (sem cupom, sem pagamento).

Tabela em aberto: botão "Registrar Saída" abre modal com tara → UPDATE status='finalizado', exit_at=now().

Tabela finalizadas: filtros por período/motorista/destino + exportação TXT/CSV/XLS/PDF.

### 6. Integração Central de Emissão

Em `src/components/CentralEmissaoPage.tsx`: adicionar nova aba/seção "Pesagens Internas" que lista `internal_weighings` finalizadas (somente consulta) visível para todos os papéis listados.

### 7. Cupom térmico 80mm

Componente `ThermalReceipt` renderiza em div oculta com classes Tailwind + bloco `<style>` print: `@page { size: 80mm auto; margin: 0 } @media print { body * { visibility: hidden } #thermal-receipt, #thermal-receipt * { visibility: visible } }`. Função `printReceipt(data)` popula via portal e chama `window.print()`.

### 8. Audit logs

Helper `logAudit(table, recordId, action, oldValue, newValue)` inserindo em `audit_logs` após cada CUD nas 4 tabelas novas. Reabertura inclui `{ reason, reason_text }` em `new_value`.

### 9. Exportação

Helper compartilhado já existe no projeto para CSV/XLS/PDF/TXT (verificar `BalancaPage` atual). Reusar mesmo padrão usado na aba Fornecedores.

### 10. Convenções

- Tokens semânticos (text-red-600, bg-gray-950, text-green-600), sem hex hardcoded
- Tabelas densas text-xs/text-[13px], py-1.5
- Zero mock — estado vazio explícito
- Sem timers de encerramento no frontend; tempo apenas exibido

### Entregáveis

- 1 migração SQL (tabelas + RLS + GRANT + trigger updated_at + pg_cron schedule)
- 7 arquivos React novos (2 tabs + 5 dialogs/helpers)
- Edição de `BalancaPage.tsx` (wrapping em Tabs) e `CentralEmissaoPage.tsx` (seção pesagens internas)
- Sem rotas novas; sem novas edge functions
