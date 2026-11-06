# Nihil — Relatório de prontidão para produção

**Data da auditoria:** 2026-11-06  
**Branch:** `main`  
**Escopo:** auditoria inicial do plano de estabilização e preparação para produção.

## A. Resumo executivo

O Nihil compila e possui uma fundação funcional de frontend Angular, backend Spring Boot, Flyway e PostgreSQL/Neon. Os testes existentes passam, mas a aplicação ainda não está pronta para ser utilizada como sistema oficial de uma empresa.

O bloqueio principal é que vários módulos operacionais ainda utilizam catálogos locais no frontend, enquanto o backend possui apenas endpoints parciais e CRUDs sem o fluxo transacional completo. A autenticação ainda é Basic Auth stateless, sem autorização por cargo implementada. Também não há evidência de backup/restauração testados, testes de integração com PostgreSQL real, testes de concorrência ou homologação dos fluxos financeiros.

**Parecer:** **NÃO — ainda existem bloqueios relevantes.** O sistema pode ser usado apenas para desenvolvimento e demonstração controlada, não para registrar a operação oficial do restaurante.

Nesta rodada foi implementada a primeira fundação de estabilização: migrations V6 de auditoria/idempotência, `AuditService`, `IdempotencyService` e aplicação desses mecanismos ao cadastro de fornecedores. Isso não altera o parecer geral porque os demais domínios ainda não foram migrados.

Também foi criado o endpoint transacional `POST /api/purchases/{purchaseId}/receive` e a migration V7 para quantidades recebidas, com suporte inicial a recebimentos parciais e bloqueio pessimista dos itens da compra. O endpoint ainda não está integrado ao frontend nem coberto por teste de integração comportamental.

Foi acrescentado um read model em `InventoryQueryController` para saldo derivado de movimentações, histórico e totais de compras, além de dois testes MockMvc para recebimento parcial, excesso e chave idempotente. Esses testes usam H2; ainda não constituem validação PostgreSQL real.

## B. Estado verificado

### Aprovado com evidência

- Estrutura monolítica modular Angular + Spring Boot presente.
- `ddl-auto` configurado como `validate` na aplicação principal.
- Flyway habilitado.
- Endpoint de health exposto para verificação operacional.
- Build frontend executado com sucesso em 2026-11-06.
- Testes frontend executados: 4 arquivos e 7 testes aprovados.
- Testes backend executados: 2 testes aprovados, sem falhas ou erros.
- Bundle inicial do frontend: aproximadamente 1,42 MB bruto e 334 kB estimados para transferência.
- Tema visual armazenado em `localStorage`, conforme permitido para preferência visual não sensível.

### Implementado nesta rodada

- Migration versionada de `audit_event` e `idempotency_key` em PostgreSQL e H2.
- Auditoria persistente aplicada ao cadastro de fornecedores.
- Reserva de `Idempotency-Key` e conflito explícito para reenvio duplicado no cadastro de fornecedores.
- Transação Spring explícita no cadastro de fornecedores.

### Pendente ou bloqueado

- Persistência operacional definitiva no PostgreSQL para todos os módulos.
- Transações completas de venda, cancelamento, estoque, compra recebida e caixa.
- Idempotência para operações críticas.
- Autorização real por cargo no backend.
- Sessões seguras, expiração, logout server-side, recuperação de senha e proteção contra abuso.
- Auditoria persistente de operações relevantes.
- Testes com PostgreSQL real isolado.
- Testes de concorrência e idempotência.
- Backup externo, restauração testada e metas RPO/RTO aprovadas.
- Monitoramento e alertas operacionais.
- Homologação manual dos fluxos essenciais.

## C. Persistência e dados

### Evidências

Ainda existem usos operacionais de armazenamento local nos serviços de estoque, menu, vendas, caixa, compras, despesas, funcionários, acesso de funcionários, fornecedores e folha. O `RemoteStorageBridgeService` espelha esses estados para `/api/workspace`, mas isso não substitui uma persistência por entidade, não garante invariantes de negócio e mantém uma fila offline sem a transação da operação original.

O backend possui `CatalogController` com endpoints básicos para alguns recursos, mas os endpoints não cobrem todos os CRUDs e não implementam os fluxos completos de negócio. Por exemplo, a criação de venda registra apenas a venda; não há no mesmo caso de uso a confirmação atômica dos itens, caixa e baixa estimada de estoque.

### Classificação

**PENDENTE — crítico.** O PostgreSQL ainda não é a fonte única de verdade dos dados operacionais.

### Próxima ação necessária

Migrar um domínio por vez para APIs reais, começando por estoque/compras/menu e depois vendas/caixa, com DTOs, validações, transações, constraints e testes de integração. As regras de cancelamento, recebimento parcial, saldo negativo e cálculo de consumo precisam ser confirmadas antes de fechar os casos de uso.

## D. Segurança

### Estado atual

O backend exige autenticação para `/api/**`, mas usa Basic Auth em cada requisição, política stateless e autoridade genérica `USER`. Não foi demonstrada autorização por cargo ou por operação. A criação/listagem de usuários não está apresentada como um fluxo completo de administração protegido por permissões específicas.

O frontend mantém a credencial Basic codificada em `sessionStorage`. Isso não é uma senha em texto puro, mas continua sendo um segredo reutilizável exposto ao JavaScript da aplicação e não atende ao modelo de sessão segura previsto no plano.

### Classificação

**PENDENTE — crítico.** Não usar a aplicação em produção com dados pessoais, financeiros ou salariais até existir autorização backend, sessão segura e testes de segurança.

## E. Financeiro

Há telas de dashboard e relatórios com indicação de valores estimados, mas ainda existem catálogos locais e não há evidência de que os números de todos os módulos venham exclusivamente do PostgreSQL. Não é possível considerar faturamento, CMV, resultado gerencial ou fluxo de caixa como números oficiais sem validar as transações que os compõem.

**PENDENTE — crítico.** Faltam regras confirmadas para reconhecimento, cancelamento, recebimento, CMV, despesas pagas e saldo de caixa.

## F. Infraestrutura

O frontend e o backend têm configuração de build e perfil de produção, mas a auditoria local não valida a configuração real do Render/Neon, variáveis efetivas, CORS publicado, migrações aplicadas no banco de produção ou comportamento após cold start. O plano registrou latência de inicialização do Render na ordem de dezenas de segundos; isso permanece uma limitação operacional até ser medido novamente no ambiente hospedado.

**BLOQUEADO — externo.** Validar deploy, cold start, logs, migrações e health checks requer acesso ao ambiente Render/Neon e não deve ser presumido a partir do build local.

## G. Testes executados

Comandos executados em 2026-11-06:

```text
pnpm --dir frontend test:ci
Resultado: 4 arquivos, 7 testes aprovados.

pnpm --dir frontend build
Resultado: sucesso; sem avisos de orçamento no build observado.

backend\\mvnw.cmd test
Resultado: 2 testes, 0 falhas, 0 erros.
```

O backend emitiu avisos de metadados de repositórios Maven não autenticados, aviso de versão H2 acima da versão verificada pelo Flyway e aviso do agente inline do Mockito. Esses avisos não impediram o build, mas devem ser tratados antes de uma pipeline de produção.

Não foram executados nesta auditoria: testes de PostgreSQL real, integração dos fluxos de negócio, testes de segurança, concorrência, restauração, backup, deploy remoto ou homologação visual/operacional.

## H. Pendências priorizadas

### Críticas

1. Remover a dependência de `localStorage`/snapshot de workspace como fonte operacional.
2. Implementar transações e idempotência para venda, cancelamento, estoque, compras e caixa.
3. Implementar autorização por cargo no backend.
4. Validar autenticação/sessão segura e proteção contra abuso.
5. Validar cálculos financeiros com dados persistidos e regras aprovadas.
6. Criar e testar backup/restauração antes de registrar dados reais.

### Altas

1. Criar testes de integração com PostgreSQL real e migrations desde banco vazio.
2. Criar auditoria persistente para operações críticas.
3. Testar concorrência e reenvio duplicado.
4. Validar Render, Neon, CORS, migrações e cold start no ambiente hospedado.
5. Cobrir erros de rede, carregamento e falhas de persistência no frontend.

### Médias

1. Remover dados/mocks demonstrativos das telas que forem migradas para dados reais.
2. Corrigir avisos de dependências e configurar pipeline de verificação.
3. Documentar operação, rollback e incidentes.

### Baixas

1. Melhorar a mensagem de diagnóstico de avisos de build/dependências.
2. Ampliar métricas e observabilidade depois dos fluxos críticos.

## I. Segunda auditoria

A segunda auditoria independente completa ainda não foi concluída porque os bloqueios críticos acima permanecem. A revisão desta rodada confirmou que a fundação de auditoria/idempotência compila e que a migration V6 passa no perfil H2, mas também confirmou que a aplicação desses mecanismos ainda está limitada ao cadastro de fornecedores. Uma segunda rodada completa deverá ser executada após a migração dos primeiros domínios e a criação dos testes de integração.

## J. Parecer final

**O Nihil está pronto para ser utilizado como sistema oficial do restaurante?**

**NÃO — ainda existem bloqueios relevantes.**

O projeto está em condição de continuar desenvolvimento e testes controlados. Para operação real, é necessário concluir a persistência transacional no PostgreSQL, segurança backend, backup/restauração, testes de integração e homologação dos fluxos financeiros e operacionais.

