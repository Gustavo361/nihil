# Bíblia de Desenvolvimento — Sistema de Gestão de Restaurante

> **Finalidade deste documento:** ser a referência viva de execução do projeto: decisões técnicas, padrões de qualidade, etapas de implementação e estado real do trabalho. Este arquivo **não substitui o README.md principal**, que deverá apresentar o produto de forma breve a quem visitar o repositório.
>
> **Nome sugerido do arquivo:** `PROJECT_BIBLE.md` (ou `docs/PROJECT_BIBLE.md`).
>
> **Regra de manutenção:** a IA deve atualizar este documento conforme o trabalho for concluído, sem marcar algo como feito, testado ou validado sem evidências reais. Quando houver dúvida, registrar como pendente.

---

## 1. Missão e visão do produto

Desenvolver um sistema empresarial de gestão interna para um restaurante. O sistema deve centralizar dados e processos operacionais, financeiros e administrativos, com ênfase em integridade, rastreabilidade, segurança, manutenção e evolução gradual.

O sistema **não será, inicialmente, uma plataforma pública de pedidos semelhante ao iFood**. As vendas serão registradas por funcionários em formulários internos. A possibilidade de integrar futuramente um sistema de caixa existente poderá ser avaliada, mas não faz parte do escopo inicial confirmado.

O restaurante trabalha com:
- Buffet livre.
- Pratos individuais preparados, incluindo à la minuta.
- Estoque de ingredientes, bebidas e demais produtos relevantes à operação.

O software é considerado um projeto sério de uso empresarial. Priorizar decisões explícitas, testes proporcionais ao risco, segurança dos dados e capacidade de manutenção — sem introduzir complexidade desnecessária apenas para parecer sofisticado.

## 2. Como usar esta Bíblia

Este documento deve ser usado como:
1. Referência das decisões e tecnologias acordadas.
2. Roteiro de desenvolvimento por etapas.
3. Checklist de qualidade e segurança.
4. Registro do estado de implementação, testes e validação.
5. Contexto para a IA de programação antes de iniciar tarefas.

### Regras obrigatórias para a IA

Antes de trabalhar:
- Ler este documento e os arquivos de instrução do repositório, como `AGENTS.md`, caso existam.
- Verificar o estado real do código, a branch atual, alterações locais e os testes disponíveis.
- Não presumir que uma tarefa já foi concluída apenas porque aparece como concluída aqui; conferir o código quando isso for relevante.
- Implementar apenas o escopo solicitado, sem reescrever módulos não relacionados.
- Explicar decisões relevantes e sinalizar dúvidas de requisitos em vez de inventar regras de negócio.

Ao terminar uma tarefa:
- Resumir arquivos e comportamentos alterados.
- Informar os comandos de validação executados e seus resultados reais.
- Distinguir claramente entre **implementado**, **testado automaticamente**, **testado manualmente** e **validado pelo responsável pelo projeto**.
- Não alegar que testes passaram se não foram executados.
- Atualizar a seção de acompanhamento desta Bíblia quando solicitado ou quando a tarefa alterar significativamente o estado do projeto.
- Não criar commits ou fazer push sem pedido/autorização explícita do responsável.

### Estados de acompanhamento

Usar os seguintes estados:
- `[ ] Pendente`
- `[-] Em andamento`
- `[x] Implementado — ainda não validado`
- `[T] Testado automaticamente — indicar o comando e o resultado`
- `[M] Testado manualmente — indicar cenário e resultado`
- `[V] Validado pelo responsável pelo projeto`

Não confundir estados. Uma funcionalidade pode estar implementada e ainda não ter sido testada. Um teste automatizado aprovado não significa necessariamente que o fluxo foi validado manualmente ou aceito pelo responsável.

---

## 3. Escopo funcional previsto

Os módulos abaixo representam o escopo planejado. A ordem de implementação poderá mudar à medida que os requisitos reais forem esclarecidos.

### 3.1 Estoque
- Cadastro de ingredientes, bebidas, mercadorias e outros itens estocados.
- Unidades de medida e conversões necessárias, como kg/g e L/ml.
- Quantidades disponíveis e movimentações de entrada e saída.
- Compras recebidas, consumo, perdas, desperdício, ajustes e inventários.
- Histórico de movimentações com data, item, quantidade, motivo e responsável.
- Estoque mínimo e alertas de reposição.
- Prevenção de inconsistências, como saídas concorrentes que gerem saldo indevido.
- Rastreabilidade suficiente para investigar divergências.

As regras exatas de estoque, tolerâncias, inventários e exceções autorizadas ainda deverão ser levantadas com o restaurante.

### 3.2 Fornecedores e compras
- Cadastro de fornecedores.
- Histórico de compras, itens, quantidades, preços e datas.
- Registro de recebimento de mercadorias.
- Possibilidade de registrar divergências, perdas e devoluções.
- Associação entre compras e registros financeiros, evitando duplicidade de lançamentos.

### 3.3 Cardápio e custos
- Cadastro de pratos, produtos vendidos e suas receitas/fichas técnicas.
- Ingredientes e quantidades estimadas por porção.
- Cálculo estimado do custo de ingredientes.
- Histórico de alterações de receitas e preços de venda.
- Comparação entre custo estimado e preço de venda.
- Consideração futura de rendimento, desperdício, embalagens e outros custos pertinentes.

**Política inicial a avaliar:** custo médio ponderado dos insumos. A regra definitiva deverá ser documentada e validada antes de ser usada como base para relatórios financeiros oficiais. Não assumir que custo de ingredientes equivale a custo total ou lucro líquido.

### 3.4 Vendas
- Registro manual por formulário interno.
- Data/hora, itens ou categorias vendidos, quantidades, preços e forma de pagamento, conforme requisitos a confirmar.
- Histórico de vendas e correções rastreáveis.
- Integração lógica com financeiro e consumo de estoque.
- Relatórios de vendas por período.

#### Buffet livre
O registro do buffet será feito por **formulário interno**. Ainda é necessário definir quais informações o formulário deverá coletar — por exemplo, quantidade de refeições, preço por categoria, descontos, refeições de funcionários ou cortesia e formas de pagamento. Não implementar essas regras por suposição.

A contabilização do consumo real de ingredientes do buffet pode não corresponder diretamente ao número de refeições vendidas. A estratégia de estimativa e reconciliação deverá ser definida com o restaurante.

### 3.5 Financeiro
- Registro de receitas e despesas.
- Contas a pagar e a receber.
- Despesas recorrentes, como aluguel, água, energia, internet e serviços.
- Registro de pagamentos e recebimentos.
- Fluxo de caixa e relatórios por período.
- Associação entre vendas, compras, despesas e pagamentos.
- Distinção entre faturamento, custos, despesas, margem e lucro.
- Histórico e rastreabilidade de ajustes.

Os relatórios devem deixar explícito o que cada total representa e não chamar de “lucro” um valor que ainda não descontou todos os custos e despesas aplicáveis.

### 3.6 Funcionários, jornada e folha
- Cadastro de funcionários, cargos e vínculos necessários.
- Salários, benefícios e comissões, conforme aplicável.
- Registro de jornadas, horários, faltas e horas extras.
- Histórico de pagamentos e informações relevantes.
- Relatórios de jornada e valores registrados.
- Controle de acesso a dados pessoais e salariais.

A automatização da folha oficial será implementada somente depois de levantar e validar as regras trabalhistas, tributárias, previdenciárias e contratuais aplicáveis com profissional competente. Não inventar regras legais nem tratar cálculos não validados como oficiais.

### 3.7 Usuários e permissões
- Administrador com acesso total.
- Usuários operacionais com permissões limitadas às suas responsabilidades.
- Autenticação e autorização no backend; esconder botões no frontend não é controle de segurança suficiente.
- Proteção de rotas e operações.
- Princípio do menor privilégio.
- Registro de ações relevantes para auditoria.
- Proteção especial para informações financeiras, pessoais e salariais.

### 3.8 Relatórios
- Vendas, receitas, despesas, custos e resultados diários, semanais, mensais e anuais.
- Consultas de estoque e movimentações.
- Histórico de preços e custos.
- Relatórios de jornada e pagamentos, conforme permissões.
- Definições consistentes de períodos, fuso horário e arredondamento.

Os requisitos e fórmulas de cada relatório devem ser documentados antes de serem tratados como fonte oficial para decisões financeiras.

---

## 4. Tecnologias acordadas

### Backend
- **Java**, usando uma versão LTS compatível com a versão de Spring Boot escolhida.
- **Spring Boot** para a aplicação backend e API HTTP.
- **Maven** como ferramenta de build e gerenciamento de dependências.
- **Spring Data JPA** para persistência relacional, quando adequado.
- **Bean Validation** para validar entradas e DTOs.
- **Spring Security** para autenticação e autorização, quando implementarmos identidade e permissões.
- **JUnit 5** para testes.
- **Mockito** quando mocks forem apropriados; preferir testes com comportamento observável e sem excesso de mocks.
- **Testcontainers** poderá ser adotado para testes de integração realistas com PostgreSQL.
- **Flyway** para versionar e aplicar migrações SQL do banco.
- Logs estruturados e tratamento consistente de erros.

A versão exata das dependências deverá ser escolhida no início do projeto, priorizando versões estáveis e compatíveis. Não atualizar versões principais automaticamente sem avaliar compatibilidade e executar testes.

### Frontend
- **Angular + TypeScript**.
- **pnpm** para gerenciar dependências, scripts e lockfile.
- Node.js em versão LTS compatível com a versão do Angular.
- Formulários tipados e validações adequadas.
- Componentes e serviços organizados por funcionalidade.
- Comunicação com o backend por API HTTP.
- Testes, lint e formatação conforme a configuração escolhida.

Identidade visual **inicial** definida (ADR `docs/decisions/0004-frontend-visual-identity.md`): paleta roxa `#6729F2` / `#9747FF`, superfície `#ECF2F9`, Plus Jakarta Sans, Tabler Icons, layout sidebar + área principal. Apache ECharts fica para dashboard/relatórios futuros. Evoluções do design system devem passar pelo responsável e atualizar o ADR.

### Banco de dados e hospedagem
- **PostgreSQL** como banco relacional principal.
- **Neon** como hospedagem inicial do PostgreSQL.
- PostgreSQL local para desenvolvimento e testes.
- Ambientes de desenvolvimento, teste e produção separados sempre que possível.
- Credenciais diferentes por ambiente e sem segredos no repositório.

O Supabase foi considerado como possível serviço secundário no futuro, mas **não será usado neste momento**. Não implementar gravação dupla nem sincronização entre dois bancos sem decisão explícita posterior.

### Versionamento e colaboração
- **Git** para versionamento.
- **GitHub** para hospedar o repositório.
- Commits atômicos e mensagens em padrão Conventional Commits.
- Branches e pull requests de acordo com o fluxo definido abaixo.
- GitHub Actions para automação de verificações, quando configurado.

### Estrutura de alto nível prevista

```text
restaurante/
├── backend/
├── frontend/
├── docs/
│   ├── architecture/
│   ├── decisions/
│   └── requirements/
├── scripts/
├── PROJECT_BIBLE.md
├── AGENTS.md
├── .editorconfig
├── .gitignore
├── README.md
└── CONTRIBUTING.md
```

Essa é uma orientação, não uma obrigação de criar todas as pastas vazias no primeiro dia. Ajustar a estrutura conforme as necessidades reais, mantendo separação clara de responsabilidades.

---

## 5. Arquitetura do software

### 5.1 Estilo arquitetural
Começar com um **monólito modular**. Não iniciar com microsserviços: eles adicionariam complexidade de deploy, comunicação, observabilidade e consistência sem benefício comprovado para o estágio inicial.

Organizar o backend por módulos de negócio, por exemplo:
- `inventory`
- `purchasing`
- `menu`
- `sales`
- `finance`
- `employees`
- `payroll`
- `identity`

Cada módulo deve ter responsabilidades claras e interfaces explícitas. Evitar dependências circulares e acesso indiscriminado às estruturas internas de outros módulos.

### 5.2 Clean Architecture e Clean Code
Aplicar princípios de Clean Code, SOLID e separação de responsabilidades com pragmatismo:
- Código claro, nomes que expressem intenção e métodos com responsabilidades bem delimitadas.
- Regras de negócio separadas de detalhes HTTP e persistência quando isso agregar valor.
- DTOs para contratos da API; não expor entidades JPA diretamente como resposta pública.
- Controllers finos, sem concentrar regras de negócio.
- Services/use cases responsáveis pelos fluxos de aplicação.
- Repositórios com consultas e persistência bem definidas.
- Validar entradas na fronteira do sistema e proteger invariantes no domínio.
- Evitar abstrações, interfaces, factories e camadas que não resolvam um problema real.
- Evitar classes gigantes, duplicação relevante e métodos com efeitos colaterais inesperados.
- Documentar decisões complexas e regras de negócio não óbvias.

Não é necessário aplicar DDD tático completo em todo o código desde o início. Introduzir entidades de domínio, value objects e outras abstrações conforme a complexidade e as invariantes justificarem.

### 5.3 Transações e integridade
- Usar transações para operações de negócio que precisem ser atômicas dentro do PostgreSQL.
- Definir regras de exclusão, atualização e histórico antes de implementá-las.
- Usar constraints de banco para invariantes que o banco pode proteger, além da validação da aplicação.
- Considerar concorrência em estoque, pagamentos e operações financeiras.
- Não confiar apenas em validações de frontend.
- Projetar operações críticas para evitar duplicidade em reenvios quando aplicável.
- Não apagar registros históricos críticos sem política explícita; avaliar cancelamento ou estorno auditável.

---

## 6. Práticas de banco de dados

### 6.1 Modelagem
- Modelar entidades e relacionamentos com base em requisitos reais.
- Usar chaves primárias e estrangeiras apropriadas.
- Aplicar `NOT NULL`, `UNIQUE`, `CHECK` e outras constraints quando pertinentes.
- Escolher tipos corretos: `NUMERIC`/`DECIMAL` para valores monetários, nunca `float`/`double` para dinheiro.
- Definir unidades de medida e regras de conversão explicitamente.
- Definir políticas de datas, timestamps e fuso horário.
- Criar índices a partir de consultas e relacionamentos reais, sem indexar tudo indiscriminadamente.
- Evitar duplicar dados sem motivo e documentar desnormalizações intencionais.
- Planejar exclusão lógica ou arquivamento apenas quando houver requisito real.

### 6.2 Flyway e migrações
- Toda mudança estrutural compartilhada deve ser registrada em uma nova migração Flyway versionada.
- Não editar uma migração que já foi aplicada em um ambiente compartilhado; criar uma nova migração corretiva.
- Não fazer alterações manuais permanentes em produção fora do histórico de migrações.
- Testar migrações em ambiente local ou descartável antes de produção.
- Avaliar como mudanças afetam dados existentes, índices, constraints, tempo de execução e possibilidade de rollback.
- Para mudanças incompatíveis, preferir etapas compatíveis: adicionar estrutura, migrar dados, atualizar aplicação e remover estrutura antiga somente depois de verificar que não é mais usada.
- Não presumir que toda migração tem rollback simples; documentar recuperação quando necessário.

### 6.3 Git e histórico do banco
Git guardará os arquivos de migração SQL e as alterações de código relacionadas. Flyway controlará a ordem e a execução das migrações no banco. **Git não é um backup do conteúdo dos dados.**

Não versionar dumps de produção, credenciais, dados pessoais, salários ou outros dados confidenciais no repositório. Dumps locais com dados reais também devem ser protegidos e não enviados por engano.

### 6.4 Backups e recuperação
- Configurar backups automatizados em armazenamento separado do banco principal.
- Não depender exclusivamente do histórico de recuperação oferecido pelo provedor.
- Documentar periodicidade, retenção, criptografia, acesso e responsável pelo processo.
- Testar a restauração periodicamente; um backup nunca restaurado não é uma garantia suficiente.
- Definir objetivos de recuperação (RPO/RTO) com base nas necessidades reais do restaurante antes da operação de produção.
- Evitar copiar dados pessoais de produção para desenvolvimento sem necessidade; preferir dados sintéticos ou anonimizados.

---

## 7. Padrões de Git e GitHub

### 7.1 Commits atômicos
Fazer commits pequenos e coerentes, cada um representando uma alteração lógica. Não é necessário um commit para cada linha, nem juntar mudanças sem relação em um único commit.

Usar Conventional Commits, com mensagens concisas, descritivas e preferencialmente em inglês:

```text
feat(inventory): add ingredient registration
fix(inventory): prevent negative stock balance
test(inventory): cover stock movement validation
refactor(finance): extract expense calculation
docs(architecture): document module boundaries
build(frontend): configure pnpm scripts
ci(github): add backend verification workflow
perf(reports): optimize monthly sales query
chore: update development tooling
```

Tipos usuais:
- `feat`: nova funcionalidade.
- `fix`: correção de defeito.
- `test`: testes.
- `refactor`: refatoração sem mudança funcional intencional.
- `docs`: documentação.
- `build`: build e dependências.
- `ci`: integração contínua.
- `perf`: desempenho.
- `chore`: manutenção.

Usar escopos de forma consistente, por exemplo `inventory`, `sales`, `finance`, `payroll`, `frontend`, `backend` e `github`. Evitar tipos e escopos inventados sem necessidade.

### 7.2 Fluxo flexível de trabalho
O responsável pelo projeto quer poder desenvolver e testar no próprio ritmo. Portanto:
- Não executar uma bateria completa de testes depois de cada pequena alteração sem necessidade.
- Durante a implementação, executar verificações direcionadas conforme o risco e o pedido.
- Quando o responsável disser que chegou o momento de testar, ajudar a executar testes automatizados e/ou preparar testes manuais.
- Antes de recomendar um commit, revisar o diff, verificar os testes pertinentes e declarar claramente o que foi e não foi validado.
- Não afirmar que uma alteração foi testada sem executar o teste ou obter confirmação explícita do teste manual.
- Se os testes falharem, informar o problema e não declarar a alteração validada.
- Fornecer a mensagem de commit sugerida e os comandos exatos quando solicitados.
- Não fazer commit ou push automaticamente sem autorização explícita.

Um commit de documentação, configuração ou trabalho intermediário poderá ter verificações diferentes de um commit que altera lógica financeira ou de estoque. O nível de validação deve ser proporcional ao risco, sem falsificar resultados.

### 7.3 Revisão e publicação
- Verificar `git status` e o diff antes de adicionar arquivos.
- Adicionar arquivos específicos, evitando `git add .` indiscriminado quando houver risco de incluir arquivos locais ou secretos.
- Nunca incluir `.env`, credenciais, chaves, dumps de produção ou dados pessoais no repositório.
- Não usar `--force`, `reset --hard` ou comandos destrutivos sem explicar consequências e obter autorização.
- Proteger a branch principal e usar pull requests quando o fluxo estiver configurado.
- Configurar CI para rodar verificações relevantes em pull requests.
- Não tratar CI verde como substituto de revisão funcional.

---

## 8. Qualidade e testes

Adotar testes em camadas, escolhendo o nível que melhor valida o comportamento.

### Backend
- Testes unitários para regras de negócio importantes.
- Testes de integração para persistência, transações e comportamento da API.
- Testes com PostgreSQL real em cenários críticos quando viável, por exemplo com Testcontainers.
- Testes de autorização para verificar que usuários sem permissão não conseguem executar operações protegidas.
- Testes de migrações em ambiente descartável ou de teste.
- Testes para casos extremos: quantidades zero/negativas, valores monetários, datas, arredondamentos, concorrência e operações repetidas, conforme aplicável.

### Frontend
- Testes de componentes e serviços para comportamentos importantes.
- Testes de formulários e validação.
- Testes dos fluxos de negócio críticos.
- Lint e formatação consistentes.
- Testes de integração ou ponta a ponta conforme o sistema amadurecer.

### Testes manuais
Documentar o cenário, os dados usados, o resultado esperado e o resultado observado. Distinguir teste manual feito pelo responsável de teste executado pela IA.

Não buscar cobertura de código alta apenas por métrica. Priorizar os comportamentos cujo defeito causaria impacto real, sobretudo estoque, vendas, dinheiro, permissões e folha de pagamento.

---

## 9. Segurança, privacidade e auditoria

- Manter segredos fora do Git e usar variáveis de ambiente ou mecanismo seguro equivalente.
- Usar credenciais distintas por ambiente e permissões mínimas.
- Aplicar autenticação e autorização no backend.
- Validar e normalizar entradas.
- Não retornar stack traces, segredos ou detalhes internos desnecessários ao cliente HTTP.
- Proteger dados pessoais, financeiros e salariais contra acessos indevidos.
- Não registrar senhas, tokens ou dados sensíveis em logs.
- Registrar ações administrativas e alterações críticas com informações suficientes para auditoria.
- Usar HTTPS nos ambientes publicados.
- Atualizar dependências com avaliação de compatibilidade e vulnerabilidades.
- Planejar recuperação de conta, gestão de sessão e proteção contra abuso quando implementar autenticação.
- Definir retenção e exclusão de dados conforme requisitos legais e operacionais.

A conformidade legal deverá ser verificada conforme o contexto brasileiro, incluindo LGPD e obrigações trabalhistas/fiscais aplicáveis. Este documento não substitui validação jurídica ou contábil.

---

## 10. Observabilidade e operação

- Usar logs estruturados, úteis para investigar falhas.
- Diferenciar erros de validação, regras de negócio, dependências externas e falhas inesperadas.
- Não expor informações sensíveis nos logs.
- Planejar health checks e monitoramento antes da produção.
- Registrar falhas em operações críticas e permitir investigação.
- Documentar procedimentos de implantação, migração, backup e restauração.
- Configurar alertas para falhas operacionais relevantes quando houver infraestrutura de monitoramento.

---

## 11. CI/CD e automação

Introduzir automação gradualmente:
1. Build do backend.
2. Testes automatizados pertinentes.
3. Build do frontend.
4. Lint e formatação.
5. Verificações de dependências e segredos.
6. GitHub Actions em pull requests.
7. Processo de deploy controlado, com configuração e segredos fora do repositório.

A pipeline deve informar falhas claramente. Não configurar deploy automático para produção antes de existirem ambientes, testes e procedimentos de recuperação adequados.

---

## 12. Estratégia de implementação

Construir em etapas pequenas, funcionais e verificáveis. A sequência abaixo é uma proposta inicial e poderá mudar conforme os requisitos do restaurante.

1. **Fundação técnica:** repositório, versões, Spring Boot, Angular, pnpm, PostgreSQL local, Neon, Flyway, configuração de ambientes e instruções para IA.
2. **Requisitos e arquitetura:** glossário, regras iniciais, limites dos módulos, decisões registradas e modelo de dados inicial.
3. **Estoque básico:** itens, unidades, entradas, saídas e histórico.
4. **Fornecedores e compras:** cadastro, recebimento e custos de aquisição.
5. **Cardápio e receitas:** pratos, fichas técnicas e custos estimados.
6. **Vendas:** formulário de registro, incluindo o fluxo específico de buffet livre.
7. **Financeiro:** despesas, contas, pagamentos, receitas e relatórios.
8. **Funcionários e jornada:** cadastro, cargos, jornadas, faltas e horas extras.
9. **Folha de pagamento:** após validação das regras aplicáveis.
10. **Usuários e permissões:** implementar segurança antes de expor operações sensíveis a múltiplos usuários; a ordem técnica poderá antecipar esta etapa.
11. **Relatórios e auditoria:** aprimorar análises, rastreabilidade e exportações.
12. **Preparação para produção:** segurança, backups, restauração, monitoramento, deploy, documentação e validação com usuários.

Não construir módulos inteiros sem entender suas entradas, saídas, regras e critérios de aceitação. Para cada funcionalidade, definir:
- Objetivo.
- Regras de negócio.
- Casos normais e casos de erro.
- Permissões necessárias.
- Alterações no banco.
- Critérios de aceitação.
- Testes pertinentes.

---

## 13. Decisões arquiteturais e requisitos ainda pendentes

Não inventar respostas para os itens abaixo. Investigar e registrar a decisão quando houver informação suficiente.

- [x] Nome oficial do sistema e do repositório: **Nihil** (nome de pasta/repositório local).
- [x] Versões exatas de Java, Spring Boot, Angular e Node.js: Java 21, Spring Boot 4.1.2, Angular 22.2.x, Node.js 22.22.3, pnpm 12.6.0.
- [ ] Biblioteca visual/design system e identidade visual.
- [ ] Fluxo detalhado do formulário de buffet livre.
- [ ] Campos e regras para vendas de pratos individuais.
- [ ] Formas de pagamento, descontos, cancelamentos, cortesias e estornos.
- [ ] Regras de inventário, perdas, ajustes e estoque mínimo.
- [ ] Política final de custo dos insumos e rendimento das receitas.
- [ ] Se o estoque deverá registrar lotes, validade e rastreabilidade por lote.
- [ ] Fluxo de caixa, regime de competência e critérios dos relatórios.
- [ ] Regras legais e operacionais da jornada e folha de pagamento.
- [ ] Papéis e permissões definitivos.
- [ ] Estratégia de autenticação e recuperação de conta.
- [ ] Requisitos de importação/exportação de dados.
- [ ] Política de backup, retenção e metas de recuperação.
- [ ] Ambiente e provedor de hospedagem do backend/frontend.
- [ ] Necessidade futura de integração com sistema de caixa existente.
- [ ] Requisitos de auditoria, retenção e conformidade legal.

As decisões importantes devem ser registradas em `docs/decisions/` como ADRs (Architecture Decision Records), com contexto, opções consideradas, decisão, consequências e data.

---

## 14. Acompanhamento do projeto

**Instrução:** atualizar esta seção ao longo do desenvolvimento. Manter um resumo breve, objetivo e baseado no estado real do repositório. Não marcar etapas como testadas ou validadas sem evidência.

### 14.1 Estado atual

- [x] Estrutura do projeto Nihil criada (backend, frontend, docs, scripts).
- [x] `README.md` principal criado.
- [x] `PROJECT_BIBLE.md` adicionado ao repositório.
- [x] `AGENTS.md` criado com instruções de desenvolvimento.
- [x] Backend Spring Boot 4.1.2 (Java 21) inicializado.
- [x] Frontend Angular 22.2 inicializado com pnpm.
- [ ] PostgreSQL local instalado/configurado no ambiente do responsável (sem Docker; instalação manual).
- [ ] Banco Neon criado e conexão configurada com segurança.
- [T] Flyway configurado; baseline `V1__foundation_baseline.sql` aplicada nos testes (H2) e no perfil `smoke`.
- [T] Build do backend executado com sucesso (`./mvnw.cmd -DskipTests package`).
- [T] Build do frontend executado com sucesso (`pnpm build`).
- [T] Testes iniciais executados (backend e frontend).
- [x] Docker removido do fluxo local (`docker-compose.yml` e scripts associados).
- [x] Atalhos na raiz (`dev` / `setup` / `stop`) e `package.json` com `pnpm dev`.
- [x] Banner Spring Boot (`banner.txt`) + saída enxuta do `dev` (portas juntas quando prontas).
- [x] Shell layout + sidebar; UI mock de Estoque (listagem/modal/movimentação) sem API.
- [ ] CI básica configurada no GitHub.
- [ ] Backups e procedimento de restauração documentados e testados.
- [ ] Repositório GitHub remoto / push — fora do escopo desta etapa (sem commit/push).

### 14.2 Registro de validações

| Data | Área/funcionalidade | Validação | Comando ou cenário | Resultado/evidência |
|---|---|---|---|---|
| 2026-11-02 | Backend package | Teste automático | `./mvnw.cmd -DskipTests package` | BUILD SUCCESS; jar gerado |
| 2026-11-02 | Backend tests | Teste automático | `./mvnw.cmd test` | Tests run: 2, Failures: 0, Errors: 0 (contextLoads + health); revalidado após banner |
| 2026-11-02 | Backend smoke start | Teste manual (IA) | `spring-boot:run` / `dev` perfil `smoke` | `GET /actuator/health` → `{"status":"UP"}` |
| 2026-11-02 | Frontend unit test | Teste automático | `pnpm test:ci` | 1 file / 1 test passed |
| 2026-11-02 | Frontend serve | Teste manual (IA) | `pnpm exec ng serve --host 127.0.0.1 --port 4200` | HTTP 200 em `/` |
| 2026-11-02 | Frontend build | Teste automático | `pnpm build` | exit 0; bundle ~210 kB |
| 2026-11-02 | `dev` (scripts) | Teste manual (IA) | mesmo terminal; banner; portas juntas; Ctrl+C/Job Object | health UP + frontend :4200 |

### 14.3 Próxima tarefa

- **Próxima tarefa:** requisitos do módulo estoque em `docs/requirements/`; depois API de estoque substituindo o mock da UI.
- **Pré-requisitos:** decisões de regra de negócio de estoque com o responsável; PostgreSQL/`DB_*` quando for persistir.
- **Critério de conclusão:** requisitos escritos e validados; endpoints de estoque cobrindo o fluxo da UI mock.

---

## 15. Definição de pronto

Uma tarefa pode ser considerada **implementada** quando o código correspondente foi criado e integrado à estrutura do projeto.

Antes de considerá-la **validada**, avaliar conforme seu risco:
- Critérios de aceitação atendidos.
- Testes pertinentes executados e aprovados, ou limitações claramente registradas.
- Nenhum segredo ou dado sensível incluído por engano.
- Tratamento de erros e permissões considerados.
- Migrações compatíveis e testadas quando houver alteração no banco.
- Diff revisado.
- Documentação atualizada quando necessário.
- Confirmação manual do responsável quando o fluxo exigir avaliação visual ou operacional.

Não é obrigatório executar uma suíte completa após cada pequena alteração durante a exploração. O responsável controla quando solicitar testes mais amplos. Contudo, não se deve recomendar um commit como pronto sem deixar claro o que foi efetivamente verificado.

---

## 16. Princípio final

A prioridade é construir um sistema **correto, seguro, compreensível, testável e sustentável**.

Não presumir que mais camadas, mais padrões ou mais abstrações tornam automaticamente o código melhor. Escolher soluções proporcionais aos requisitos reais, documentar decisões importantes e evoluir sem perder rastreabilidade.

Usar IA como acelerador, não como substituto de validação. Revisar mudanças críticas, testar regras de negócio, preservar dados e registrar honestamente o estado do projeto.

Esta Bíblia é um documento vivo: as decisões podem evoluir, desde que as mudanças sejam explícitas, justificadas e refletidas no código, nos testes e na documentação.
