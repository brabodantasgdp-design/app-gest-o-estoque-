-- Execute uma vez no Supabase para habilitar login por senha da tabela User.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS user_email_unique
  ON "User" (email);

CREATE INDEX IF NOT EXISTS user_tenant_idx
  ON "User" (tenant_id);
