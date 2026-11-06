package com.nihil.purchasing;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PurchaseReceivingControllerTest {
  @Autowired MockMvc mockMvc;
  @Autowired JdbcTemplate jdbc;

  private UUID purchaseId;
  private UUID purchaseItemId;

  @BeforeEach
  void setUp() {
    var itemId = UUID.randomUUID();
    purchaseId = UUID.randomUUID();
    purchaseItemId = UUID.randomUUID();
    var now = OffsetDateTime.now();
    jdbc.update("insert into inventory_item(id,name,unit,minimum_quantity,active,created_at,updated_at) values(?,?,?,?,?,?,?)",
        itemId, "Arroz teste", "kg", new BigDecimal("1"), true, now, now);
    jdbc.update("insert into purchase(id,purchased_at,status,total_amount,created_at,updated_at) values(?,?,?,?,?,?)",
        purchaseId, now, "DRAFT", new BigDecimal("100"), now, now);
    jdbc.update("insert into purchase_item(id,purchase_id,inventory_item_id,quantity,unit_price) values(?,?,?,?,?)",
        purchaseItemId, purchaseId, itemId, new BigDecimal("10"), new BigDecimal("10"));
  }

  @Test
  void supportsPartialReceivingAndRejectsDuplicateKey() throws Exception {
    var body = "{\"lines\":[{\"purchaseItemId\":\"" + purchaseItemId + "\",\"quantity\":\"4\"}]}";
    mockMvc.perform(post("/api/purchases/{id}/receive", purchaseId)
            .with(user("admin")).header("Idempotency-Key", "receive-1")
            .contentType("application/json").content(body))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.partiallyReceived").value(true))
        .andExpect(jsonPath("$.movementsCreated").value(1));

    mockMvc.perform(post("/api/purchases/{id}/receive", purchaseId)
            .with(user("admin")).header("Idempotency-Key", "receive-1")
            .contentType("application/json").content(body))
        .andExpect(status().isConflict());
  }

  @Test
  void rejectsReceivingAboveOrderedQuantityWithoutMovement() throws Exception {
    var body = "{\"lines\":[{\"purchaseItemId\":\"" + purchaseItemId + "\",\"quantity\":\"11\"}]}";
    mockMvc.perform(post("/api/purchases/{id}/receive", purchaseId)
            .with(user("admin")).header("Idempotency-Key", "receive-over")
            .contentType("application/json").content(body))
        .andExpect(status().isConflict());

    Integer count = jdbc.queryForObject("select count(*) from stock_movement where reference_id=?", Integer.class, purchaseId);
    org.junit.jupiter.api.Assertions.assertEquals(0, count);
  }
}
