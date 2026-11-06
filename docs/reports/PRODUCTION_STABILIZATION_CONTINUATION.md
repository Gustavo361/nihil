# Continuidade — estabilização do Nihil

## Ponto de parada

Data: 2026-11-06  
Branch: `main`  
Sem commit, push ou deploy.

## Implementado nesta etapa

- Criada a migration `V6__audit_and_idempotency.sql` para PostgreSQL.
- Criada a migration equivalente para H2 de testes.
- Criado `AuditService` para registrar ator, operação, entidade, resultado e horário sem gravar credenciais.
- Criado `IdempotencyService` para reservar `Idempotency-Key` dentro da transação da operação.
- Aplicada transação, idempotência e auditoria ao `POST /api/suppliers`.
- Criada migration `V7__purchase_receiving_quantities.sql` para suportar recebimento parcial.
- Criado `POST /api/purchases/{purchaseId}/receive`, que bloqueia a compra e os itens com `FOR UPDATE`, valida o limite recebido, registra `PURCHASE_RECEIPT` e atualiza o status quando todos os itens foram recebidos.
- Criado `InventoryQueryController` com leituras de saldo derivado das movimentações, histórico de movimentos e totais comprado/recebido.
- Criado `PurchaseReceivingControllerTest` cobrindo recebimento parcial, rejeição acima do pedido e reenvio com a mesma chave.

## Validação executada

- `backend\\mvnw.cmd test`: 2 testes aprovados, 0 falhas, 0 erros.
- A migração V6 foi aplicada durante o contexto de testes H2.
- A migração V7 foi aplicada durante o contexto de testes H2.
- `backend\\mvnw.cmd -Dtest=PurchaseReceivingControllerTest test`: 2 testes aprovados, 0 falhas, 0 erros.

## Estado ainda não resolvido

- Os serviços operacionais do frontend ainda usam catálogos locais/snapshot de workspace.
- O endpoint de recebimento de compras foi criado, mas ainda não foi integrado ao frontend e ainda precisa de testes de integração de comportamento.
- As leituras do novo modelo ainda não foram integradas ao frontend.
- Vendas, baixas de estoque e caixa ainda não formam casos de uso transacionais completos.
- A idempotência ainda não foi aplicada aos fluxos de venda, estoque, despesa e caixa; o recebimento usa a infraestrutura, mas ainda não tem teste de reenvio.
- A autorização por cargo ainda não foi implementada no backend.
- Não há teste PostgreSQL real, teste de concorrência ou teste de restauração.
- Backup, Render/Neon e monitoramento continuam dependentes de validação externa.

## Próxima etapa obrigatória

Concluir o vertical slice de estoque e compras recebidas:

1. Criar DTOs validados para item, movimento, compra e item de compra.
2. Integrar o frontend ao `POST /api/purchases/{id}/receive` sem atualização otimista antes da confirmação do servidor.
3. Registrar/consultar o saldo de estoque a partir do PostgreSQL, incluindo a decisão sobre saldo negativo.
4. Adicionar testes de integração, reenvio idempotente e concorrência antes de avançar para vendas.

Não repetir a auditoria inicial; usar este documento e o relatório de prontidão como contexto.

## Bloqueio atual de validação PostgreSQL

Em 2026-11-06, `127.0.0.1:5432` respondeu e o serviço PostgreSQL 16 estava ativo, mas as credenciais carregadas de `backend/.env` foram recusadas pelo banco local (`password authentication failed for user "neondb_owner"`). Essas credenciais aparentam apontar para Neon e não serão reutilizadas para testes locais. Os testes H2 do endpoint passaram, porém a validação PostgreSQL real, concorrência e persistência após reinicialização aguardam credenciais locais ou um banco de teste local acessível.

Em 2026-11-06, a tentativa read-only via `neon psql production --pooled -- -c "SELECT 1;"` identificou o endpoint Neon, mas ficou sem resposta por mais de 60 segundos e foi interrompida. Nenhuma alteração foi executada. A conectividade direta pela rede atual ainda não foi comprovada.
