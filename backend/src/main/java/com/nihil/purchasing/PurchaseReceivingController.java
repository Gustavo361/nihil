package com.nihil.purchasing;

import com.nihil.shared.AuditService;
import com.nihil.shared.IdempotencyService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** Atomic receiving use case: received quantities and stock entries share one transaction. */
@RestController
@RequestMapping("/api/purchases")
public class PurchaseReceivingController {
  private final JdbcTemplate jdbc;
  private final AuditService audit;
  private final IdempotencyService idempotency;

  public PurchaseReceivingController(JdbcTemplate jdbc, AuditService audit, IdempotencyService idempotency) {
    this.jdbc = jdbc;
    this.audit = audit;
    this.idempotency = idempotency;
  }

  @PostMapping("/{purchaseId}/receive")
  @ResponseStatus(HttpStatus.OK)
  @Transactional
  ReceiveResponse receive(@PathVariable UUID purchaseId, @Valid @RequestBody ReceiveRequest request,
      @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
    idempotency.claim(idempotencyKey, "purchase.receive");
    var purchase = jdbc.query("select status from purchase where id=? for update",
        rs -> rs.next() ? rs.getString("status") : null, purchaseId);
    if (purchase == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Compra não encontrada.");
    if ("CANCELLED".equals(purchase)) throw new ResponseStatusException(HttpStatus.CONFLICT, "Compra cancelada.");

    int movementCount = 0;
    for (ReceiveLine line : request.lines()) {
      var item = jdbc.query("select quantity, received_quantity, inventory_item_id, unit_price from purchase_item where id=? and purchase_id=? for update",
          rs -> rs.next() ? new ItemRow(rs.getBigDecimal("quantity"), rs.getBigDecimal("received_quantity"),
              rs.getObject("inventory_item_id", UUID.class), rs.getBigDecimal("unit_price")) : null,
          line.purchaseItemId(), purchaseId);
      if (item == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Item da compra não encontrado.");
      var next = item.received().add(line.quantity());
      if (next.compareTo(item.ordered()) > 0) {
        throw new ResponseStatusException(HttpStatus.CONFLICT, "Recebimento maior que a quantidade comprada.");
      }
      jdbc.update("update purchase_item set received_quantity=? where id=?", next, line.purchaseItemId());
      var now = OffsetDateTime.now();
      jdbc.update("insert into stock_movement(id,item_id,type,quantity,occurred_at,reference_type,reference_id,notes,created_at) values(?,?,?,?,?,?,?,?,?)",
          UUID.randomUUID(), item.inventoryItemId(), "PURCHASE_RECEIPT", line.quantity(), now,
          "PURCHASE", purchaseId, line.note(), now);
      movementCount++;
    }
    var pending = jdbc.queryForObject("select count(*) from purchase_item where purchase_id=? and received_quantity < quantity",
        Integer.class, purchaseId);
    if (pending != null && pending == 0) jdbc.update("update purchase set status='RECEIVED', updated_at=? where id=?", OffsetDateTime.now(), purchaseId);
    audit.success("purchase.receive", "purchase", purchaseId, "Itens recebidos: " + movementCount);
    return new ReceiveResponse(purchaseId, movementCount, pending != null && pending > 0);
  }

  private record ItemRow(BigDecimal ordered, BigDecimal received, UUID inventoryItemId, BigDecimal unitPrice) {}
  public record ReceiveRequest(@NotEmpty List<@Valid ReceiveLine> lines) {}
  public record ReceiveLine(@NotNull UUID purchaseItemId, @NotNull @DecimalMin(value = "0.0001") BigDecimal quantity, String note) {}
  public record ReceiveResponse(UUID purchaseId, int movementsCreated, boolean partiallyReceived) {}
}
