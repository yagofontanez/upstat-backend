import { db } from "./database";

async function migrate() {
  const client = await db.connect();

  try {
    console.log("🔄 Running migrations...");

    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

      -- Users
      CREATE TABLE IF NOT EXISTS users (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name        TEXT NOT NULL,
        email       TEXT UNIQUE NOT NULL,
        password    TEXT NOT NULL,
        plan        TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- Monitors
      CREATE TABLE IF NOT EXISTS monitors (
        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name            TEXT NOT NULL,
        url             TEXT NOT NULL,
        interval_minutes INT NOT NULL DEFAULT 5,
        status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'up', 'down', 'degraded')),
        is_active       BOOLEAN NOT NULL DEFAULT true,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- Pings
      CREATE TABLE IF NOT EXISTS pings (
        id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        monitor_id    UUID NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
        status        TEXT NOT NULL CHECK (status IN ('up', 'down', 'timeout')),
        status_code   INT,
        latency_ms    INT,
        checked_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- Incidents
      CREATE TABLE IF NOT EXISTS incidents (
        id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        monitor_id    UUID NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
        started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        resolved_at   TIMESTAMPTZ,
        duration_ms   BIGINT
      );

      -- Status Pages
      CREATE TABLE IF NOT EXISTS pages (
        id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id       UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        slug          TEXT UNIQUE NOT NULL,
        title         TEXT NOT NULL DEFAULT 'Status Page',
        description   TEXT,
        logo_url      TEXT,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- Page <-> Monitor (which monitors show on the page)
      CREATE TABLE IF NOT EXISTS page_monitors (
        page_id     UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
        monitor_id  UUID NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
        position    INT NOT NULL DEFAULT 0,
        PRIMARY KEY (page_id, monitor_id)
      );

      -- Notification settings
      CREATE TABLE IF NOT EXISTS notifications (
        id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id       UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        email_enabled BOOLEAN NOT NULL DEFAULT true,
        whatsapp_enabled BOOLEAN NOT NULL DEFAULT false,
        whatsapp_number TEXT,
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_monitors_user_id ON monitors(user_id);
      CREATE INDEX IF NOT EXISTS idx_pings_monitor_id ON pings(monitor_id);
      CREATE INDEX IF NOT EXISTS idx_pings_checked_at ON pings(checked_at DESC);
      CREATE INDEX IF NOT EXISTS idx_incidents_monitor_id ON incidents(monitor_id);
    `);

    console.log("✅ Migrations complete!");
  } catch (err) {
    console.error("❌ Migration failed:", err);
    throw err;
  } finally {
    client.release();
    await db.end();
  }
}

migrate();
