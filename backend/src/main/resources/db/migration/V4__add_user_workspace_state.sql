-- Transitional persistence for existing Angular workspaces. The browser is
-- never the source of truth; each authenticated user's state lives in Neon.
CREATE TABLE user_workspace_state (
  username VARCHAR(80) NOT NULL REFERENCES app_user(username),
  state_key VARCHAR(80) NOT NULL,
  payload TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (username, state_key)
);
