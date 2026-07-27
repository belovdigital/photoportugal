import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
}

export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/** Minimal interface for a connected pool client used in transactions. */
interface TransactionClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query(text: string, params?: unknown[]): Promise<{ rows: any[]; rowCount: number | null }>;
  release(): void;
}

/**
 * Execute a callback within a database transaction.
 * Automatically handles BEGIN/COMMIT/ROLLBACK and client release.
 */
export async function withTransaction<T>(
  fn: (client: TransactionClient) => Promise<T>
): Promise<T> {
  // pool.connect() exists at runtime but @types/pg .d.mts doesn't expose it for bundler resolution
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client: TransactionClient = await (pool as any).connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** A client held idle across a long run needs its own error surface. */
interface LockClient extends TransactionClient {
  on(event: "error", listener: (err: Error) => void): void;
  removeListener(event: "error", listener: (err: Error) => void): void;
}

/**
 * Run `fn` while holding a Postgres session-level advisory lock on a
 * DEDICATED connection.
 *
 * Why dedicated: pg_try_advisory_lock is scoped to the backend SESSION.
 * Taking it through query()/queryOne() puts it on whichever connection the
 * pool happened to hand out, and that connection goes straight back to the
 * pool — where the idle reaper (idleTimeoutMillis, 10s by default) closes it
 * and drops the lock, typically long before a multi-minute cron finishes. A
 * later pg_advisory_unlock() through the pool then almost certainly lands on
 * a DIFFERENT backend, where it is a no-op returning false, stranding the
 * original lock if that connection did happen to survive. The cron routes
 * did exactly this, so their "prevent concurrent runs" guard protected
 * nothing for most of each run.
 *
 * Returns { acquired: false } without running fn when the lock is held.
 * Released in the finally; if the process dies first, Postgres releases it
 * when the backend goes away.
 *
 * Deliberately NOT a transaction — holding one open for a whole cron run
 * would pin a snapshot and block vacuum for the duration.
 */
export async function withAdvisoryLock<T>(
  key: number,
  fn: () => Promise<T>
): Promise<{ acquired: true; result: T } | { acquired: false; result?: undefined }> {
  // pool.connect() exists at runtime but @types/pg .d.mts doesn't expose it for bundler resolution
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client: LockClient = await (pool as any).connect();
  // pg-pool removes its own 'error' listener while a client is checked out.
  // We hold this one idle for the whole run, so a backend restart or dropped
  // socket in that window would emit 'error' with no listeners — an uncaught
  // exception that kills the process. Keep one attached.
  const onClientError = (e: Error) =>
    console.error("[db] advisory lock client error", key, e);
  client.on("error", onClientError);
  let held = false;
  try {
    const res = await client.query("SELECT pg_try_advisory_lock($1::bigint) AS acquired", [key]);
    held = res.rows[0]?.acquired === true;
    if (!held) return { acquired: false };
    return { acquired: true, result: await fn() };
  } finally {
    if (held) {
      await client
        .query("SELECT pg_advisory_unlock($1::bigint)", [key])
        .catch((e: unknown) => console.error("[db] advisory unlock failed", key, e));
    }
    client.removeListener("error", onClientError);
    client.release();
  }
}

export { pool };
export default pool;
