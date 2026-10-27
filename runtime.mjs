import { DatabaseSync } from "node:sqlite";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  copyFileSync,
} from "node:fs";
import { resolve } from "node:path";
import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";

export const FRONTEND_ORIGIN = "https://mi-cuarto-ut-brian-gr.surge.sh";
const dataDir = resolve(process.env.MCUT_DATA_DIR || "data");
mkdirSync(dataDir, { recursive: true });
mkdirSync(resolve(dataDir, "photos"), { recursive: true });
const dbFile = resolve(dataDir, "mi_cuarto_ut.sqlite");
if (!existsSync(dbFile))
  copyFileSync(resolve("database/mi_cuarto_ut.sqlite"), dbFile);
const sqlite = new DatabaseSync(dbFile);
sqlite.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,salt TEXT NOT NULL,password_hash TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS auth_attempts(source TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);`);

class Statement {
  constructor(sql, values = []) {
    this.sql = sql;
    this.values = values;
  }
  bind(...values) {
    return new Statement(this.sql, values);
  }
  async first() {
    return sqlite.prepare(this.sql).get(...this.values) || null;
  }
  async all() {
    return { results: sqlite.prepare(this.sql).all(...this.values) };
  }
  async run() {
    return sqlite.prepare(this.sql).run(...this.values);
  }
}
export const env = {
  DB: {
    prepare: (sql) => new Statement(sql),
    batch: async (statements) => Promise.all(statements.map((s) => s.run())),
  },
  BUCKET: {
    async put(id, bytes, meta) {
      if (!/^[a-f0-9-]{36}$/.test(id))
        throw new Error("Identificador inválido");
      writeFileSync(resolve(dataDir, "photos", id), bytes);
      writeFileSync(
        resolve(dataDir, "photos", id + ".json"),
        JSON.stringify(meta),
      );
    },
    async get(id) {
      if (!/^[a-f0-9-]{36}$/.test(id)) return null;
      try {
        const meta = JSON.parse(
          readFileSync(resolve(dataDir, "photos", id + ".json"), "utf8"),
        );
        return {
          body: new Uint8Array(readFileSync(resolve(dataDir, "photos", id))),
          ...meta,
        };
      } catch {
        return null;
      }
    },
  },
};
const digest = (s) => createHash("sha256").update(s).digest("hex");
export async function requestUser(req) {
  const raw = req.headers.get("authorization") || "";
  if (!/^Bearer [a-f0-9]{64}$/.test(raw)) return null;
  const row = sqlite
    .prepare(
      `SELECT a.id,p.name,a.email FROM sessions s JOIN accounts a ON a.id=s.user_id LEFT JOIN profiles p ON p.id=a.id WHERE s.token_hash=? AND s.expires_at>?`,
    )
    .get(digest(raw.slice(7)), new Date().toISOString());
  return row
    ? {
        userId: row.id,
        displayName: row.name || row.email,
        email: row.email,
        fullName: row.name || null,
      }
    : null;
}
const response = (data, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
const allowedOrigin = (req) => {
  const origin = req.headers.get("origin");
  return (
    !origin ||
    origin === FRONTEND_ORIGIN ||
    /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin)
  );
};
export async function auth(req, ip) {
  const route = new URL(req.url).pathname;
  if (!route.startsWith("/api/auth/")) return null;
  if (req.method !== "POST")
    return response({ error: "Método no permitido." }, 405);
  if (!allowedOrigin(req))
    return response({ error: "Origen no permitido." }, 403);
  if (route === "/api/auth/logout") {
    const token = (req.headers.get("authorization") || "").slice(7);
    if (/^[a-f0-9]{64}$/.test(token))
      sqlite
        .prepare("DELETE FROM sessions WHERE token_hash=?")
        .run(digest(token));
    return response({ ok: true });
  }
  if (!["/api/auth/register", "/api/auth/login"].includes(route))
    return response({ error: "Ruta no encontrada." }, 404);
  const now = new Date().toISOString(),
    cutoff = new Date(Date.now() - 3600000).toISOString(),
    source = digest(ip + now.slice(0, 10));
  sqlite.prepare("DELETE FROM auth_attempts WHERE created_at<?").run(cutoff);
  if (
    sqlite
      .prepare("SELECT count(*) AS n FROM auth_attempts WHERE source=?")
      .get(source).n >= 30
  )
    return response(
      { error: "Demasiados intentos. Inténtalo más tarde." },
      429,
    );
  sqlite.prepare("INSERT INTO auth_attempts VALUES(?,?)").run(source, now);
  const raw = await req.text();
  if (raw.length > 16000)
    return response({ error: "Solicitud demasiado grande." }, 413);
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return response({ error: "Datos inválidos." }, 400);
  }
  const email =
    typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 254 ||
    typeof data.password !== "string" ||
    data.password.length < 12 ||
    data.password.length > 128
  )
    return response(
      { error: "Revisa el correo y la contraseña (12 a 128 caracteres)." },
      400,
    );
  let account = sqlite
    .prepare("SELECT * FROM accounts WHERE email=?")
    .get(email);
  if (route.endsWith("/register")) {
    const name = String(data.name || "")
        .trim()
        .slice(0, 100),
      role = data.role;
    if (
      name.length < 2 ||
      !["estudiante", "maestro", "rentador"].includes(role) ||
      data.consent !== true
    )
      return response(
        { error: "Completa tu nombre, perfil y consentimiento." },
        400,
      );
    if (account)
      return response(
        { error: "Ese correo ya está registrado. Inicia sesión." },
        409,
      );
    const id = crypto.randomUUID(),
      salt = randomBytes(16).toString("hex"),
      hash = scryptSync(data.password, salt, 64).toString("hex");
    sqlite.exec("BEGIN IMMEDIATE");
    try {
      sqlite
        .prepare("INSERT INTO accounts VALUES(?,?,?,?,?)")
        .run(id, email, salt, hash, now);
      sqlite
        .prepare("INSERT INTO profiles VALUES(?,?,?,?,?)")
        .run(id, name, email, role, now);
      sqlite.exec("COMMIT");
    } catch (e) {
      sqlite.exec("ROLLBACK");
      throw e;
    }
    account = { id, email };
  } else {
    const computed = scryptSync(
      data.password,
      account?.salt || "00000000000000000000000000000000",
      64,
    );
    if (
      !account ||
      !timingSafeEqual(computed, Buffer.from(account.password_hash, "hex"))
    )
      return response({ error: "Correo o contraseña incorrectos." }, 401);
  }
  const token = randomBytes(32).toString("hex");
  sqlite.prepare("DELETE FROM sessions WHERE expires_at<?").run(now);
  sqlite
    .prepare("INSERT INTO sessions VALUES(?,?,?)")
    .run(
      digest(token),
      account.id,
      new Date(Date.now() + 86400000).toISOString(),
    );
  const profile = sqlite
    .prepare("SELECT id,name,email,role FROM profiles WHERE id=?")
    .get(account.id);
  return response(
    { token, user: { name: profile.name, email: account.email }, profile },
    route.endsWith("/register") ? 201 : 200,
  );
}
