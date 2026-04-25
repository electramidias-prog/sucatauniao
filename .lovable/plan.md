## Objetivo

Novo módulo **Central de Emissão NF-e / MTR** em `/central-emissao`, com fluxo wizard em 3 etapas que parte de um extrato bancário do SICOOB (.xlsx), faz o cruzamento automático com a base de clientes, e gera arquivos prontos para emissão de NF-e e MTR, além de registrar as pesagens no banco.

## Etapas do Wizard

### Etapa 1 — Upload do Extrato SICOOB
- Campo de upload `.xlsx` (drag & drop + botão).
- Leitura com **SheetJS (`xlsx`)** — biblioteca a ser adicionada via `bun add xlsx`.
- O parser pula as primeiras 10 linhas e detecta automaticamente a linha de header procurando pelas colunas: `Data Movimento`, `Histórico`, `Destinatário`, `CPF/CNPJ do Destinatário`, `Instituição`, `Valor`. Caso a linha 11 não bata, varre até a linha 30 procurando esses rótulos (tolerante a acentos / caixa).
- Pré-visualização em tabela das linhas lidas (com contagem total e total em R$).
- Campo **Preço Base R$/kg** (numérico, obrigatório, aceita decimais).
- **Histórico dos últimos preços usados**: persistido em `localStorage` (`nfe_price_history`) — últimos 10 valores como chips clicáveis abaixo do input.
- Botão **Avançar** habilitado apenas com arquivo válido + preço > 0.

### Etapa 2 — Matching Automático com Clientes
- Para cada linha, normaliza o `Destinatário` (lowercase, trim, remove espaços duplos, remove acentos) e cruza contra `clients.name` e `clients.nickname` da Supabase. Match exato após normalização → linha verde; sem match → linha vermelha.
- Linhas verdes preenchem automaticamente: `cpf_cnpj` (vindo de `clients.document_number`), `vehicle_plate` (vindo de `clients.vehicle_plate`), e `peso_calculado = valor / preço_kg` (3 casas decimais).
- Linhas vermelhas exibem um **Combobox de busca** (busca por nome/apelido/documento) para o operador escolher o cliente manualmente; ao selecionar, os campos derivados são preenchidos.
- Todos os campos (cliente, CPF/CNPJ, placa, peso) ficam editáveis inline antes de prosseguir.
- Indicador no topo: "X de Y casados automaticamente" + botão **Avançar** habilitado apenas quando todas as linhas têm cliente vinculado.

### Etapa 3 — Fila de Emissão e Exportação
- Tabela final: Data | Nome | CPF/CNPJ | Placa | Valor R$ | Preço/kg | Peso (kg, 3 dec.) | Classificação (Select por linha: Sucata Mista, Sucata Pesada, Limaria, Fundido, Amortecedor) | Status (Pronto / Pendente — Pendente se faltar classificação ou placa).
- Botão **Exportar NF-e (CSV)** → colunas: `Nome, CPF_CNPJ, Data, Peso_KG, Valor_RS, Classificacao, Placa`.
- Botão **Exportar MTR (CSV)** → colunas: `CPF_CNPJ_Gerador, Nome_Gerador, Placa_Veiculo, Tipo_Residuo, Peso_KG, Data_Coleta`.
- CSVs gerados client-side com separador `;` e encoding UTF-8 BOM (compatível com Excel BR), download via `Blob`.
- Botão **Registrar no Sistema** → faz `insert` em `weighings` (uma linha por item) com:
  - `client_id`, `vehicle_plate`, `material_type` (mapeado do label para o enum interno: mista/pesada/limaria/fundido/amortecedor), `gross_weight = peso`, `tare_weight = 0`, `net_weight = peso`, `price_per_kg`, `total_value = valor`, `status = 'pago'`, `notes = "Importado SICOOB <data>"`, `created_by = auth.uid()`.
  - Mostra toast com nº de pesagens criadas e fecha/limpa o wizard.

## Arquivos

**Novos:**
- `src/components/CentralEmissaoPage.tsx` — componente principal com state machine das 3 etapas (`useState<'upload' | 'matching' | 'fila'>`), parsing, matching e exportação.

**Editados:**
- `src/App.tsx` — registrar rota `/central-emissao`.
- `src/config/menu.ts` — adicionar item "Central de Emissão NF-e/MTR" (ícone `FileSpreadsheet`) na seção **Operação**, roles `admin` e `financeiro`.
- `src/components/AppSidebar.tsx` — incluir `FileSpreadsheet` no `iconMap`.
- `package.json` — dependência `xlsx` (via `bun add xlsx`).

## Detalhes Técnicos

- **Parser SICOOB**: usa `XLSX.read(arrayBuffer)` → `sheet_to_json(sheet, { header: 1, raw: false })` para varredura linha-a-linha; após localizar o header, mapeia índices das colunas e gera registros tipados.
- **Normalização para matching**: `str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()`.
- **Datas**: tenta interpretar `Data Movimento` em `DD/MM/YYYY` e converte para ISO (`YYYY-MM-DD`) na exportação.
- **Valores**: aceita `R$ 1.234,56` ou `1234.56` — normaliza para `Number`.
- **Material default** ao chegar na Etapa 3: `Sucata Mista`. Operador troca por linha.
- **Permissões**: somente roles `admin` e `financeiro` veem o menu e a rota.
- **Sem mudanças de schema** no banco — utiliza `clients` (leitura) e `weighings` (insert) já existentes; o status `'pago'` já está mapeado em `STATUS_MAP` da Balança.
