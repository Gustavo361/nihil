package com.nihil.shared;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Stores current UI workspace snapshots in PostgreSQL, scoped to the logged-in user. */
@RestController
@RequestMapping("/api/workspace")
public class WorkspaceStateController {
  private static final Pattern KEY = Pattern.compile("[a-z0-9._-]{1,80}");
  private final JdbcTemplate jdbc;
  private final ObjectMapper objectMapper;

  WorkspaceStateController(JdbcTemplate jdbc, ObjectMapper objectMapper) {
    this.jdbc = jdbc;
    this.objectMapper = objectMapper;
  }

  @GetMapping("/{key}")
  ResponseEntity<JsonNode> read(@PathVariable String key) {
    validateKey(key);
    var payloads = jdbc.query(
        "select payload from user_workspace_state where username=? and state_key=?",
        (rs, rowNum) -> rs.getString("payload"), username(), key);
    if (payloads.isEmpty()) return ResponseEntity.noContent().build();
    try {
      return ResponseEntity.ok(objectMapper.readTree(payloads.getFirst()));
    } catch (JacksonException exception) {
      throw new IllegalStateException("Estado remoto inválido.", exception);
    }
  }

  @GetMapping
  Map<String, JsonNode> readAll() {
    var result = new LinkedHashMap<String, JsonNode>();
    jdbc.query("select state_key, payload from user_workspace_state where username=?", rs -> {
      try {
        result.put(rs.getString("state_key"), objectMapper.readTree(rs.getString("payload")));
      } catch (JacksonException exception) {
        throw new IllegalStateException("Estado remoto inválido.", exception);
      }
    }, username());
    return result;
  }

  @PutMapping("/{key}")
  @Transactional
  ResponseEntity<Void> write(@PathVariable String key, @RequestBody JsonNode payload) {
    validateKey(key);
    try {
      var now = OffsetDateTime.now();
      var serialized = objectMapper.writeValueAsString(payload);
      var changed = jdbc.update(
          "update user_workspace_state set payload=?, updated_at=? where username=? and state_key=?",
          serialized, now, username(), key);
      if (changed == 0) {
        jdbc.update("insert into user_workspace_state(username,state_key,payload,updated_at) values(?,?,?,?)",
            username(), key, serialized, now);
      }
      return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    } catch (JacksonException exception) {
      throw new IllegalArgumentException("Estado inválido.", exception);
    }
  }

  private static void validateKey(String key) {
    if (!KEY.matcher(key).matches()) throw new IllegalArgumentException("Chave de estado inválida.");
  }

  private static String username() {
    return SecurityContextHolder.getContext().getAuthentication().getName();
  }
}
