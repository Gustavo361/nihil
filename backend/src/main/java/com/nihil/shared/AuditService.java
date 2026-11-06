package com.nihil.shared;

import java.time.OffsetDateTime;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

/** Persists operational events without recording credentials or request bodies. */
@Service
public class AuditService {
  private final JdbcTemplate jdbc;

  public AuditService(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  public void success(String operation, String entityType, UUID entityId, String details) {
    record(operation, entityType, entityId, "SUCCESS", details);
  }

  public void failure(String operation, String entityType, UUID entityId, String details) {
    record(operation, entityType, entityId, "FAILURE", details);
  }

  private void record(String operation, String entityType, UUID entityId, String outcome, String details) {
    jdbc.update(
        "insert into audit_event(id,actor_username,operation,entity_type,entity_id,outcome,details,occurred_at) values(?,?,?,?,?,?,?,?)",
        UUID.randomUUID(), actor(), operation, entityType, entityId, outcome, truncate(details), OffsetDateTime.now());
  }

  private static String actor() {
    Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
    return authentication == null || !authentication.isAuthenticated() ? null : authentication.getName();
  }

  private static String truncate(String value) {
    if (value == null) return null;
    return value.length() <= 2000 ? value : value.substring(0, 2000);
  }
}
