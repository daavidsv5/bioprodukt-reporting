// scripts/migrateUsers.js
// Vytvoří tabulku users v Neon DB a přenese data z data/users.json

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Načti .env.local ručně
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '');
  }
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function migrate() {
  const client = await pool.connect();
  try {
    // Vytvoř tabulku
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id          TEXT PRIMARY KEY,
        email       TEXT UNIQUE NOT NULL,
        name        TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role        TEXT NOT NULL DEFAULT 'user',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✓ Tabulka users vytvořena (nebo již existuje)');

    // Načti users.json
    const usersPath = path.join(__dirname, '..', 'data', 'users.json');
    const users = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));

    // Vlož uživatele
    for (const u of users) {
      await client.query(
        `INSERT INTO users (id, email, name, password_hash, role, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO NOTHING`,
        [u.id, u.email, u.name, u.passwordHash, u.role, u.createdAt]
      );
      console.log(`✓ Uživatel ${u.email} přenesen`);
    }

    console.log('=== Migrace dokončena ===');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => {
  console.error('Chyba:', err.message);
  process.exit(1);
});
