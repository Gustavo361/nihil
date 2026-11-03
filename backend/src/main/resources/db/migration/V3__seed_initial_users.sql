-- Initial credentials are stored only as BCrypt hashes. Do not replace these with plaintext passwords.
INSERT INTO app_user (id, username, password_hash, display_name, active)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'admin', '$2a$10$Dk7mruRnURndcR0sH8S16uut2s0/9mrbyGDe0D5onDCypuNRElhZe', 'Administrador', TRUE),
  ('00000000-0000-0000-0000-000000000002', 'caixa', '$2a$10$2unM8T2/eGLeY63KP4uiL.Xb3jsew8Z4f6NNfseA/13BHEk8TjWGu', 'Caixa', TRUE)
ON CONFLICT (username) DO NOTHING;
