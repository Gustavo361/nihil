package com.nihil.shared;

import java.math.BigDecimal;
import java.sql.Date;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** HTTP boundary for the current Angular form catalogues. */
@RestController
@RequestMapping("/api")
public class CatalogController {
  private final JdbcTemplate jdbc;
  public CatalogController(JdbcTemplate jdbc) { this.jdbc = jdbc; }

  @GetMapping("/employees") List<Map<String, Object>> employees() { return jdbc.queryForList("select id, name, role_name as role, monthly_cost, status, notes from employee order by name"); }
  @PostMapping("/employees") @ResponseStatus(HttpStatus.CREATED) Map<String, Object> employee(@RequestBody Map<String, Object> b) {
    var id = UUID.randomUUID(); jdbc.update("insert into employee(id,name,role_name,monthly_cost,status,notes,created_at,updated_at) values(?,?,?,?,?,?,?,?)", id, required(b,"name"), required(b,"role"), money(b,"monthlyCost"), value(b,"status","ACTIVE"), nullable(b,"notes"), OffsetDateTime.now(), OffsetDateTime.now()); return Map.of("id", id);
  }

  @GetMapping("/inventory-items") List<Map<String, Object>> inventory() { return jdbc.queryForList("select id,name,unit,minimum_quantity,active from inventory_item order by name"); }
  @PostMapping("/inventory-items") @ResponseStatus(HttpStatus.CREATED) Map<String, Object> inventory(@RequestBody Map<String, Object> b) {
    var id = UUID.randomUUID(); jdbc.update("insert into inventory_item(id,name,unit,minimum_quantity,active,created_at,updated_at) values(?,?,?,?,?,?,?)", id, required(b,"name"), required(b,"unit"), decimal(b,"minimumQuantity", BigDecimal.ZERO), bool(b,"active",true), OffsetDateTime.now(), OffsetDateTime.now()); return Map.of("id", id);
  }

  @GetMapping("/menu-items") List<Map<String, Object>> menu() { return jdbc.queryForList("select id,name,sale_price,active from menu_item order by name"); }
  @PostMapping("/menu-items") @ResponseStatus(HttpStatus.CREATED) Map<String, Object> menu(@RequestBody Map<String, Object> b) {
    var id = UUID.randomUUID(); jdbc.update("insert into menu_item(id,name,sale_price,active,created_at,updated_at) values(?,?,?,?,?,?)", id, required(b,"name"), money(b,"salePrice"), bool(b,"active",true), OffsetDateTime.now(), OffsetDateTime.now()); return Map.of("id", id);
  }

  @GetMapping("/expenses") List<Map<String, Object>> expenses() { return jdbc.queryForList("select id,description,category,amount,due_date,status,paid_at,recurrence,notes from expense order by due_date desc"); }
  @PostMapping("/expenses") @ResponseStatus(HttpStatus.CREATED) Map<String, Object> expense(@RequestBody Map<String, Object> b) {
    var id = UUID.randomUUID(); jdbc.update("insert into expense(id,description,category,amount,due_date,status,recurrence,notes,created_at,updated_at) values(?,?,?,?,?,?,?,?,?,?)", id, required(b,"description"), value(b,"category","VARIABLE"), money(b,"amount"), Date.valueOf(required(b,"dueDate")), value(b,"status","PENDING"), value(b,"recurrence","NONE"), nullable(b,"notes"), OffsetDateTime.now(), OffsetDateTime.now()); return Map.of("id", id);
  }

  @GetMapping("/stock-movements") List<Map<String,Object>> stockMovements() { return jdbc.queryForList("select * from stock_movement order by occurred_at desc"); }
  @PostMapping("/stock-movements") @ResponseStatus(HttpStatus.CREATED) Map<String,Object> stockMovement(@RequestBody Map<String,Object> b) {
    var id=UUID.randomUUID(); jdbc.update("insert into stock_movement(id,item_id,type,quantity,occurred_at,notes,created_at) values(?,?,?,?,?,?,?)",id,UUID.fromString(required(b,"itemId")),value(b,"type","ADJUSTMENT"),decimal(b,"quantity",null),OffsetDateTime.now(),nullable(b,"notes"),OffsetDateTime.now()); return Map.of("id",id);
  }

  @GetMapping("/purchases") List<Map<String,Object>> purchases() { return jdbc.queryForList("select * from purchase order by purchased_at desc"); }
  @PostMapping("/purchases") @ResponseStatus(HttpStatus.CREATED) Map<String,Object> purchase(@RequestBody Map<String,Object> b) {
    var id=UUID.randomUUID(); jdbc.update("insert into purchase(id,supplier_id,purchased_at,status,total_amount,notes,created_at,updated_at) values(?,?,?,?,?,?,?,?)",id,uuid(b,"supplierId"),OffsetDateTime.now(),value(b,"status","DRAFT"),money(b,"totalAmount"),nullable(b,"notes"),OffsetDateTime.now(),OffsetDateTime.now()); return Map.of("id",id);
  }

  @GetMapping("/sales") List<Map<String,Object>> sales() { return jdbc.queryForList("select * from sale order by sold_at desc"); }
  @PostMapping("/sales") @ResponseStatus(HttpStatus.CREATED) Map<String,Object> sale(@RequestBody Map<String,Object> b) {
    var id=UUID.randomUUID(); jdbc.update("insert into sale(id,employee_id,sold_at,payment_method,status,total_amount,created_at,updated_at) values(?,?,?,?,?,?,?,?)",id,uuid(b,"employeeId"),OffsetDateTime.now(),required(b,"paymentMethod"),value(b,"status","CONFIRMED"),money(b,"totalAmount"),OffsetDateTime.now(),OffsetDateTime.now()); return Map.of("id",id);
  }

  @GetMapping("/payroll-runs") List<Map<String,Object>> payrollRuns() { return jdbc.queryForList("select * from payroll_run order by reference_month desc"); }
  @PostMapping("/payroll-runs") @ResponseStatus(HttpStatus.CREATED) Map<String,Object> payrollRun(@RequestBody Map<String,Object> b) {
    var id=UUID.randomUUID(); jdbc.update("insert into payroll_run(id,reference_month,status,total_amount,created_at,updated_at) values(?,?,?,?,?,?)",id,Date.valueOf(required(b,"referenceMonth")),value(b,"status","DRAFT"),money(b,"totalAmount"),OffsetDateTime.now(),OffsetDateTime.now()); return Map.of("id",id);
  }

  @GetMapping("/cash-sessions") List<Map<String,Object>> cashSessions() { return jdbc.queryForList("select * from cash_session order by opened_at desc"); }
  @PostMapping("/cash-sessions") @ResponseStatus(HttpStatus.CREATED) Map<String,Object> cashSession(@RequestBody Map<String,Object> b) {
    var id=UUID.randomUUID(); jdbc.update("insert into cash_session(id,opened_by_employee_id,opened_at,opening_amount,status,notes,created_at) values(?,?,?,?,?,?,?)",id,uuid(b,"employeeId"),OffsetDateTime.now(),money(b,"openingAmount"),"OPEN",nullable(b,"notes"),OffsetDateTime.now()); return Map.of("id",id);
  }

  @GetMapping("/recipes") List<Map<String,Object>> recipes() { return jdbc.queryForList("select * from menu_recipe_item"); }
  @PostMapping("/recipes") @ResponseStatus(HttpStatus.CREATED) void recipe(@RequestBody Map<String,Object> b) { jdbc.update("insert into menu_recipe_item(menu_item_id,inventory_item_id,quantity) values(?,?,?)",UUID.fromString(required(b,"menuItemId")),UUID.fromString(required(b,"inventoryItemId")),decimal(b,"quantity",null)); }
  @GetMapping("/purchase-items") List<Map<String,Object>> purchaseItems() { return jdbc.queryForList("select * from purchase_item"); }
  @PostMapping("/purchase-items") @ResponseStatus(HttpStatus.CREATED) Map<String,Object> purchaseItem(@RequestBody Map<String,Object> b) { var id=UUID.randomUUID(); jdbc.update("insert into purchase_item(id,purchase_id,inventory_item_id,quantity,unit_price) values(?,?,?,?,?)",id,UUID.fromString(required(b,"purchaseId")),UUID.fromString(required(b,"inventoryItemId")),decimal(b,"quantity",null),money(b,"unitPrice")); return Map.of("id",id); }
  @GetMapping("/sale-items") List<Map<String,Object>> saleItems() { return jdbc.queryForList("select * from sale_item"); }
  @PostMapping("/sale-items") @ResponseStatus(HttpStatus.CREATED) Map<String,Object> saleItem(@RequestBody Map<String,Object> b) { var id=UUID.randomUUID(); jdbc.update("insert into sale_item(id,sale_id,menu_item_id,description,quantity,unit_price) values(?,?,?,?,?,?)",id,UUID.fromString(required(b,"saleId")),uuid(b,"menuItemId"),required(b,"description"),decimal(b,"quantity",null),money(b,"unitPrice")); return Map.of("id",id); }
  @GetMapping("/payroll-entries") List<Map<String,Object>> payrollEntries() { return jdbc.queryForList("select * from payroll_entry"); }
  @PostMapping("/payroll-entries") @ResponseStatus(HttpStatus.CREATED) Map<String,Object> payrollEntry(@RequestBody Map<String,Object> b) { var id=UUID.randomUUID(); jdbc.update("insert into payroll_entry(id,payroll_run_id,employee_id,amount) values(?,?,?,?)",id,UUID.fromString(required(b,"payrollRunId")),UUID.fromString(required(b,"employeeId")),money(b,"amount")); return Map.of("id",id); }
  @GetMapping("/cash-movements") List<Map<String,Object>> cashMovements() { return jdbc.queryForList("select * from cash_movement order by occurred_at desc"); }
  @PostMapping("/cash-movements") @ResponseStatus(HttpStatus.CREATED) Map<String,Object> cashMovement(@RequestBody Map<String,Object> b) { var id=UUID.randomUUID(); jdbc.update("insert into cash_movement(id,cash_session_id,type,amount,occurred_at,notes,created_at) values(?,?,?,?,?,?,?)",id,UUID.fromString(required(b,"cashSessionId")),value(b,"type","ADJUSTMENT"),money(b,"amount"),OffsetDateTime.now(),nullable(b,"notes"),OffsetDateTime.now()); return Map.of("id",id); }

  private static String required(Map<String,Object> body, String key) { var v=nullable(body,key); if(v==null) throw new IllegalArgumentException("Campo obrigatório: "+key); return v; }
  private static String nullable(Map<String,Object> body, String key) { var v=body.get(key); return v == null || v.toString().isBlank() ? null : v.toString().trim(); }
  private static String value(Map<String,Object> body,String key,String fallback) { var v=nullable(body,key); return v==null?fallback:v.toUpperCase(); }
  private static boolean bool(Map<String,Object> b,String key,boolean fallback) { var v=b.get(key); return v==null?fallback:Boolean.parseBoolean(v.toString()); }
  private static UUID uuid(Map<String,Object> b,String key) { var value=nullable(b,key); return value==null?null:UUID.fromString(value); }
  private static BigDecimal money(Map<String,Object> b,String k) { return decimal(b,k,null); }
  private static BigDecimal decimal(Map<String,Object> b,String k,BigDecimal fallback) { var v=b.get(k); if(v==null && fallback!=null)return fallback; if(v==null)throw new IllegalArgumentException("Campo obrigatório: "+k); return new BigDecimal(v.toString()); }
}
