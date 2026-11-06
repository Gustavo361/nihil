package com.nihil.shared;

import java.time.OffsetDateTime;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/** Claims a client operation key inside the same transaction as the business write. */
@Service
public class IdempotencyService {
  private final JdbcTemplate jdbc;

  public IdempotencyService(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  public void claim(String key, String operation) {
    if (key == null || key.isBlank()) return;
    if (key.length() > 120 || !key.matches("[A-Za-z0-9._:-]+")) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Idempotency-Key inválida.");
    }
    try {
      jdbc.update("insert into idempotency_key(key_value,actor_username,operation,created_at) values(?,?,?,?)",
          key, actor(), operation, OffsetDateTime.now());
    } catch (DuplicateKeyException exception) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Operação duplicada.", exception);
    }
  }

  private static String actor() {
    Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
    return authentication == null || !authentication.isAuthenticated() ? null : authentication.getName();
  }
}
