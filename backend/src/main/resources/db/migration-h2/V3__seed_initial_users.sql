-- H2 equivalent of the PostgreSQL V3 seed. Kept separate because H2 2.x does
-- not support PostgreSQL's INSERT ... ON CONFLICT syntax.
CREATE TABLE IF NOT EXISTS app_user (
  id UUID PRIMARY KEY,
  username VARCHAR(80) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(160) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

MERGE INTO app_user (id, username, password_hash, display_name, active)
KEY(username)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'admin', '$2a$10$Dk7mruRnURndcR0sH8S16uut2s0/9mrbyGDe0D5onDCypuNRElhZe', 'Administrador', TRUE),
  ('00000000-0000-0000-0000-000000000002', 'caixa', '$2a$10$2unM8T2/eGLeY63KP4uiL.Xb3jsew8Z4f6NNfseA/13BHEk8TjWGu', 'Caixa', TRUE);
