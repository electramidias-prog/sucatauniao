# ERP Sucata União

Sistema web full-stack para gestão completa de uma empresa de reciclagem de sucata metálica: pesagem, estoque físico e fiscal, conta corrente de fornecedores, faturamento, compliance ambiental (MTR/FEAM/SINIR), RH com NRs, EPIs, DDS, máquinas e laudos.

**Stack:** React 18 · Vite · TypeScript · Tailwind · shadcn/ui · Lovable Cloud (PostgreSQL + Auth + Storage + Edge Functions) · Lovable AI Gateway

**URLs:**
- Preview: https://id-preview--5b664b62-96d8-46ef-86b5-0adbbcb7f029.lovable.app
- Produção: https://sucatauniao.lovable.app

---

## Módulos

| Domínio | Módulos |
|---|---|
| **Operação** | Balança/Pesagem · Estoque Físico · Estoque Fiscal · Central NF-e/MTR · Calculadora MTR |
| **Financeiro** | Conta Corrente · Avulsos · Contas a Pagar · Faturamento |
| **Clientes** | CRM 360 · PIX · Mudanças sob aprovação |
| **RH & SST** | Funcionários + NRs · EPIs · DDS · Máquinas e Laudos · Documentos da Empresa |
| **Admin** | Usuários · Auditoria · Configurações · Calendário · Relatórios & BI |
| **IA** | ANA (orientação) · CARLINHOS (extração de documentos fiscais) |

## Papéis (RBAC)

`admin` · `financeiro` · `operador_balanca` · `conferente` · `contador`

Papéis em tabela `user_roles` separada, verificados via `has_role(uid, role)` em todas as policies RLS.

## Convenções

- Cores de marca: vermelho, branco, preto, verde — sempre via tokens semânticos.
- Dados reais apenas — proibido mock/fake.
- UI de alta densidade estilo planilha.
- Toda tabela exporta TXT, CSV, XLS e PDF.
- Shadow logging de todo CUD em `audit_logs`.
- Operadores não podem excluir logs nem tickets.

## Documentação Completa

Veja o relatório consolidado em PDF: **ERP_Sucata_Uniao_Documentacao.pdf** (gerado em `/mnt/documents/`).

Inclui mapa de módulos, arquitetura de dados, integrações, RBAC, roadmap dos Sprints 1-5, auditoria técnica com pendências priorizadas e estrutura de pastas.

## Pendências (Sprint 5 em andamento)

- 🚧 Chat da Equipe (rota `/chat` ainda é placeholder)
- ⏳ Portal do Cliente (self-service)
- ⏳ Integração Balança RS232 produção
- ⏳ WhatsApp API oficial
- ⏳ Roteamento de `CalculadoraMTRPage` no menu