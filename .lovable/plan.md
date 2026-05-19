# Plano: Organização e Documentação do ERP Sucata União

Vou entregar **um relatório PDF completo** + **reorganização do código-fonte** em uma única passagem.

---

## Etapa 1 — Auditoria Técnica (somente leitura)

Vou varrer o projeto e mapear:

1. **Inventário de módulos** — todos os arquivos em `src/components/*Page.tsx`, rotas em `App.tsx`, itens do menu em `menu.ts` e suas permissões por papel (RBAC).
2. **Inventário do banco** — 30+ tabelas existentes, agrupadas por domínio (Operação, Financeiro, RH, Compliance, Portal), com RLS e triggers ativos.
3. **Storage buckets** — 7 buckets, finalidade e políticas.
4. **Edge functions** — `ai-chat`, `create-user`.
5. **Pendências detectadas**:
   - Rotas órfãs (ex.: `/chat` ainda aponta para `PlaceholderPage`).
   - Componentes existentes não roteados (ex.: `CalculadoraMTRPage`).
   - Tabelas sem uso aparente no front.
   - Inconsistências de RLS (ex.: papéis citados na memória que não existem no enum: "almoxarife", "encarregado", "tecnico_seguranca").
   - Linter do Supabase (rodar `supabase--linter`).

## Etapa 2 — Reorganização de Pastas e Menu

Refatorar `src/components/` em subpastas por domínio, sem quebrar imports:

```text
src/components/
├── operacao/     (Balanca, EstoqueFisico, EstoqueFiscal, CentralEmissao, CalculadoraMTR)
├── financeiro/   (ContaCorrente, Avulsos, ContasPagar, Faturamento)
├── clientes/     (Clients, ImportMappingDialog)
├── rh/           (Funcionarios, EPIs, DDS)
├── compliance/   (Documentos, Maquinas)
├── admin/        (Users, Auditoria, Configuracoes)
├── shared/       (AppLayout, AppSidebar, NavLink, RefreshButton, etc.)
└── ai/           (AIChatPanel)
```

Atualizar todos os imports em `App.tsx`, `routePreload.ts` e referências cruzadas. Revisar `menu.ts` para confirmar agrupamentos coerentes e adicionar `/calculadora-mtr` se faltar.

## Etapa 3 — Documentação Consolidada (PDF)

Gerar `/mnt/documents/ERP_Sucata_Uniao_Documentacao.pdf` via `reportlab`, com seções:

1. **Capa** — logo/nome, versão, data, ambiente (Lovable Cloud).
2. **Sumário Executivo** — visão geral do sistema, stack, status.
3. **Mapa de Módulos** — tabela: Módulo · Rota · Arquivo · Papéis com acesso · Status (✅ Pronto / 🚧 Parcial / ⏳ Pendente).
4. **Arquitetura de Dados** — diagrama textual das 30+ tabelas agrupadas por domínio, com RLS resumido.
5. **Integrações** — Wix Webhook, Balança WebSerial, WhatsApp, OneDrive, Lovable AI (ANA + CARLINHOS).
6. **Controle de Acesso (RBAC)** — matriz papel × módulo.
7. **Roadmap Consolidado** — Sprints 1-5 com checklist do que foi entregue, em andamento e pendente (Portal do Cliente, Chat Global, integrações finais).
8. **Auditoria Técnica** — pendências encontradas, riscos de segurança, recomendações priorizadas.
9. **Estrutura de Pastas Pós-Refatoração** — árvore final do `src/`.
10. **Anexos** — convenções (logging, exports, branding), credenciais de admin, URLs do projeto.

## Etapa 4 — README.md no Repositório

Versão enxuta do PDF no `README.md` da raiz, para quem clonar o repo via GitHub ver o estado do projeto.

## Etapa 5 — QA do PDF

Converter cada página em imagem (`pdftoppm`) e inspecionar visualmente antes de entregar.

---

## O que NÃO será feito neste plano

- Nenhuma migração de banco / mudança de schema.
- Nenhuma alteração de lógica de negócio nos módulos existentes.
- Nada de novas features (Portal do Cliente, Chat real, etc.) — apenas documentadas como pendentes no roadmap.

## Entregáveis

- `/mnt/documents/ERP_Sucata_Uniao_Documentacao.pdf` (download)
- `README.md` atualizado
- `src/components/` reorganizado por domínio com todos os imports corrigidos

Posso implementar?
