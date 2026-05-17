CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
  id TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  name TEXT,
  email TEXT UNIQUE,
  "emailVerified" TIMESTAMPTZ,
  image TEXT,
  PRIMARY KEY (id)
);

CREATE TABLE accounts (
  id TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expires_at BIGINT,
  token_type TEXT,
  scope TEXT,
  id_token TEXT,
  session_state TEXT,
  PRIMARY KEY (id),
  UNIQUE (provider, "providerAccountId")
);

CREATE TABLE sessions (
  id TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "sessionToken" TEXT NOT NULL UNIQUE,
  "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE verification_token (
  identifier TEXT NOT NULL,
  token TEXT NOT NULL,
  expires TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (identifier, token)
);

CREATE TABLE waitlist (
  id TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);
