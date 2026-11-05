ALTER TABLE app_user ADD COLUMN email VARCHAR(254);
CREATE UNIQUE INDEX ux_app_user_email ON app_user(email) WHERE email IS NOT NULL;
