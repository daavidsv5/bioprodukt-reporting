import pool from './db';

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 30 * 60 * 1000; // 30 minut

interface LockoutInfo {
  limited: boolean;
  retryAfterMs: number;
}

/**
 * Zkontroluje, zda je email aktuálně zablokován.
 * Vrací { limited: true, retryAfterMs } pokud počet pokusů v okně překročil limit.
 */
export async function isRateLimited(email: string): Promise<LockoutInfo> {
  const windowStart = new Date(Date.now() - WINDOW_MS);

  const result = await pool.query<{ count: string; oldest: Date }>(
    `SELECT COUNT(*) AS count, MIN(attempted_at) AS oldest
     FROM login_attempts
     WHERE email = $1 AND attempted_at > $2`,
    [email.toLowerCase(), windowStart]
  );

  const count = parseInt(result.rows[0].count, 10);

  if (count >= MAX_ATTEMPTS) {
    const oldest: Date = result.rows[0].oldest;
    const retryAfterMs = Math.max(0, oldest.getTime() + WINDOW_MS - Date.now());
    return { limited: true, retryAfterMs };
  }

  return { limited: false, retryAfterMs: 0 };
}

/**
 * Zaznamená neúspěšný pokus o přihlášení pro daný email.
 */
export async function recordFailedAttempt(email: string): Promise<void> {
  await pool.query(
    `INSERT INTO login_attempts (email, attempted_at) VALUES ($1, NOW())`,
    [email.toLowerCase()]
  );
}

/**
 * Smaže všechny pokusy pro daný email (volá se po úspěšném přihlášení).
 */
export async function clearAttempts(email: string): Promise<void> {
  await pool.query(
    `DELETE FROM login_attempts WHERE email = $1`,
    [email.toLowerCase()]
  );
}
