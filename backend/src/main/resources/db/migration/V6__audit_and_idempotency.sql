CREATE TABLE audit_event (
  id UUID PRIMARY KEY,
  actor_username VARCHAR(80),
  operation VARCHAR(80) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id UUID,
  outcome VARCHAR(20) NOT NULL CHECK (outcome IN ('SUCCESS', 'FAILURE')),
  details VARCHAR(2000),
  occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_audit_event_occurred_at ON audit_event(occurred_at);
CREATE INDEX idx_audit_event_entity ON audit_event(entity_type, entity_id);

CREATE TABLE idempotency_key (
  key_value VARCHAR(120) PRIMARY KEY,
  actor_username VARCHAR(80),
  operation VARCHAR(80) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
