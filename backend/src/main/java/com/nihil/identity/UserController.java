package com.nihil.identity;

import jakarta.validation.constraints.NotBlank;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController @RequestMapping("/api/users")
public class UserController {
  private final JdbcTemplate jdbc; private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
  public UserController(JdbcTemplate jdbc) { this.jdbc=jdbc; }
  @GetMapping List<Map<String,Object>> list() { return jdbc.queryForList("select id,username,email,display_name,active,created_at from app_user order by username"); }
  @PostMapping @ResponseStatus(HttpStatus.CREATED) Map<String,Object> create(@RequestBody UserRequest request) {
    if (request.username()==null || !request.username().matches("[a-zA-Z0-9._-]{3,80}")) throw new IllegalArgumentException("Usuário inválido.");
    if (request.password()==null || request.password().length()<12) throw new IllegalArgumentException("A senha precisa ter no mínimo 12 caracteres.");
    if (request.email()==null || !request.email().matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) throw new IllegalArgumentException("E-mail inválido.");
    var id=UUID.randomUUID(); var now=OffsetDateTime.now(); jdbc.update("insert into app_user(id,username,email,password_hash,display_name,active,created_at,updated_at) values(?,?,?,?,?,?,?,?)",id,request.username().toLowerCase(),request.email().trim().toLowerCase(),encoder.encode(request.password()),request.displayName(),true,now,now); return Map.of("id",id,"username",request.username().toLowerCase(),"email",request.email().trim().toLowerCase());
  }
  public record UserRequest(@NotBlank String username,@NotBlank String email,@NotBlank String displayName,@NotBlank String password) {}
}
