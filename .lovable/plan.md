## Portal do Cliente — Plano de Implementação

Módulo self-service externo para fornecedores, totalmente isolado do ERP interno, com login próprio, dashboard de saldo/pesagens/pagamentos e geração de PDF.

### 1. Banco de Dados (migração Supabase)

- Criar tabela `portal_credentials` (client_id, email único, password_hash, is_active, last_login_at, created_by)
- Criar tabela `portal_sessions` (client_id, token UUID, expires_at default +8h)
- Adicionar coluna `portal_access_enabled` em `clients` (já existe — confirmar) e `portal_user_id`
- Tabela `portal_login_attempts` para rate limiting (ip, attempted_at, success)
- RLS:
  - `portal_credentials`: admin/financeiro gerenciam (ALL). Edge function usa service role para validar login.
  - `portal_sessions`: nenhuma policy pública (apenas service role via edge).
  - `portal_login_attempts`: idem.
- Função `has_role` já existe e será reutilizada.

### 2. Edge Function `portal-auth`

`supabase/functions/portal-auth/index.ts` (sem JWT, pública):

- Actions: `login`, `logout`, `validate`
- `login`:
  - Rate limit: bloqueia IP com 5+ falhas em 10min (consulta `portal_login_attempts`)
  - Busca credencial por email, valida bcrypt (`npm:bcryptjs`)
  - Cria sessão (token UUID + expires_at +8h), atualiza `last_login_at`
  - Grava tentativa em `portal_login_attempts` e em `audit_logs` (success/fail, ip)
  - Retorna `{ token, client_id, client_name }` — erro genérico "Credenciais inválidas"
- `validate`: verifica token existe + não expirado → retorna `{ client_id, client_name }`
- `logout`: deleta sessão pelo token
- Outra edge function `portal-credentials` (admin/financeiro autenticado) para criar/redefinir credencial: faz hash bcrypt e grava em `portal_credentials`.

### 3. Rotas e Layout (App.tsx)

- Rotas `/portal/login` e `/portal/dashboard` montadas FORA do `AuthenticatedApp` / `AppLayout`
- Redirect `/portal` → `/portal/login`
- `PortalLayout`: header preto com logo "SUCATA UNIÃO", nome do cliente, botão sair. Sem sidebar.

### 4. Arquivos a criar

- `src/components/portal/PortalLogin.tsx` — formulário email/senha, link "Acesso ao sistema interno →"
- `src/components/portal/PortalLayout.tsx` — header + outlet
- `src/components/portal/PortalDashboard.tsx` — dashboard com abas/seções abaixo
- `src/components/portal/PortalTicketPDF.ts` — gerador jsPDF
- `src/hooks/usePortalAuth.ts` — estado via `sessionStorage`, valida token ao montar, expira em 2h inativo
- `src/components/ClientPortalAccessDialog.tsx` — modal de gestão de acesso no ERP
- Integração no `ClientsPage.tsx`: toggle ativo + botão "Configurar Acesso"

### 5. Dashboard — Seções

1. **Card de Saldo**: soma `client_transactions` (créditos − débitos) filtrado por client_id (via edge segura ou query autenticada com token validado). Realtime subscribe em `client_transactions` filtrado por `client_id`.
2. **Pesagens (50 últimas)**: join `weighings + weighing_fractions`. Oculta preço/valor se status ≠ finalizado. Botão "Baixar PDF" por linha.
3. **Pagamentos**: `client_transactions` type='debit' efetivados.
4. **Vales/Adiantamentos abertos**: type='debit' status='pendente' ou descrição ILIKE '%vale%'/'%adiantamento%'.
5. **Extrato completo** (aba): todas as movimentações com saldo acumulado + export CSV.

### 6. Segurança — Acesso aos Dados

Como o portal NÃO usa Supabase Auth (auth.uid() é null), criar edge function `portal-data` que:
- Recebe `token` + `query_type` (balance | weighings | transactions | pending_vales | ticket)
- Valida token em `portal_sessions`, recupera `client_id`
- Executa query com service role, sempre filtrando por `client_id` da sessão
- Nunca aceita `client_id` do cliente — sempre derivado do token
- Nunca retorna dados bancários (pix_key, bank_account, bank_agency, bank_name)

### 7. PDF do Ticket (jsPDF)

Função utilitária que recebe ticket completo e gera PDF com cabeçalho Sucata União, CNPJ 49.520.286/0001-25, dados do cliente, placa, tabela de materiais (bruto/tara/líquido/preço/subtotal), totais, rodapé. Download como `ticket-{n}-{data}.pdf`.

### 8. Gestão no ERP (ClientsPage)

Botão "Portal" por linha → abre `ClientPortalAccessDialog`:
- Status atual (ativo desde / sem acesso)
- Toggle ativo/inativo (atualiza `portal_access_enabled`)
- Campo email + senha (com gerador 12 chars seguros) → chama `portal-credentials` edge
- "Redefinir senha" sempre disponível, senha nunca exibida após salvar
- Grava em `audit_logs`

### 9. Convenções

- Tokens: vermelho `text-red-600`/`bg-red-600`, preto `bg-gray-950`, branco `text-white`
- Sem dados mock, estados vazios explícitos
- Tabelas densas (text-xs/text-[13px], py-1.5)
- Botões Salvar/Cancelar/Fechar funcionais
- Export CSV no extrato
- Audit log em todas operações CUD com referência ao client_id

### 10. Detalhes Técnicos

- **bcrypt na edge**: `import bcrypt from "npm:bcryptjs@2.4.3"`
- **Edge functions configuradas com `verify_jwt = false`** em `supabase/config.toml` para `portal-auth` e `portal-data`; `portal-credentials` exige JWT (admin/financeiro)
- **Realtime**: subscription anônima funciona com RLS — mas como portal não usa auth, criar policy SELECT em `client_transactions` para `anon` é inseguro. Alternativa: polling a cada 30s + reload manual. **Decisão**: usar polling + botão "Atualizar" (realtime real exigiria expor RLS pública). Manter o `channel` listener apenas se RLS permitir; caso contrário, polling.
  - Aprovação: implementar polling 30s como mecanismo principal de atualização (mais seguro), mantendo botão "Atualizar".
- Verificar coluna `portal_access_enabled` e `portal_user_id` já existem em `clients` (presentes no schema) — migração só ajusta FK se necessário.

### Entregáveis

- 1 migração SQL
- 3 edge functions (`portal-auth`, `portal-data`, `portal-credentials`)
- 6 arquivos React/TS novos
- Edição de `App.tsx` e `ClientsPage.tsx`
- Config functions em `supabase/config.toml`
