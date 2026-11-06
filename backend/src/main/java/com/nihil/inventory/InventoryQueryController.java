package com.nihil.inventory;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Read model for stock screens; balances are derived from persisted movements. */
@RestController
@RequestMapping("/api/inventory")
public class InventoryQueryController {
  private final JdbcTemplate jdbc;

  public InventoryQueryController(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @GetMapping("/items")
  List<Map<String, Object>> items() {
    return jdbc.queryForList("""
        select i.id, i.name, i.unit, i.minimum_quantity, i.active,
               coalesce(sum(case
                 when m.type in ('PURCHASE_RECEIPT', 'ADJUSTMENT', 'INVENTORY_COUNT') then m.quantity
                 when m.type in ('SALE_CONSUMPTION', 'LOSS') then -m.quantity
                 else 0 end), 0) as available_quantity
          from inventory_item i
          left join stock_movement m on m.item_id = i.id
         group by i.id, i.name, i.unit, i.minimum_quantity, i.active
         order by i.name
        """);
  }

  @GetMapping("/movements")
  List<Map<String, Object>> movements() {
    return jdbc.queryForList("""
        select m.id, m.item_id, i.name as item_name, i.unit, m.type, m.quantity,
               m.occurred_at, m.reference_type, m.reference_id, m.notes
          from stock_movement m
          join inventory_item i on i.id = m.item_id
         order by m.occurred_at desc
        """);
  }

  @GetMapping("/purchases")
  List<Map<String, Object>> purchases() {
    return jdbc.queryForList("""
        select p.id, p.supplier_id, p.purchased_at, p.status, p.total_amount, p.notes,
               coalesce(sum(pi.quantity), 0) as ordered_quantity,
               coalesce(sum(pi.received_quantity), 0) as received_quantity
          from purchase p
          left join purchase_item pi on pi.purchase_id = p.id
         group by p.id, p.supplier_id, p.purchased_at, p.status, p.total_amount, p.notes
         order by p.purchased_at desc
        """);
  }
}
