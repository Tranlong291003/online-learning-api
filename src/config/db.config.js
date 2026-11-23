const { AsyncLocalStorage } = require("node:async_hooks");
require("dotenv").config();

const requestDatabase = new AsyncLocalStorage();
let cloudflareBindings = null;
const booleanColumns = new Set(["is_active", "is_read", "is_completed"]);

function normalizeD1Binding(value) {
  if (value instanceof Date) {
    return value.toISOString().replace("T", " ").replace("Z", "");
  }
  if (typeof value === "boolean") return Number(value);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    return new Date(value).toISOString().replace("T", " ").replace("Z", "");
  }
  return value;
}

function normalizeD1Row(row) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => {
      if (booleanColumns.has(key) && value !== null) return [key, Boolean(value)];
      if (typeof value === "string" && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value)) {
        return [key, `${value.replace(" ", "T")}Z`];
      }
      return [key, value];
    })
  );
}

const useSsl = process.env.DB_SSL === "true";

// DATABASE_URL chỉ dùng cho local Node.js; Worker luôn lấy dữ liệu từ D1 binding.
// Chuỗi rỗng phải được coi là chưa cấu hình,
// nếu không pg sẽ nhận connectionString rỗng và kết nối đi sai chỗ.
const databaseUrl = (process.env.DATABASE_URL || "").trim();

const poolConfig = databaseUrl
  ? {
      connectionString: databaseUrl,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
    }
  : {
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_DATABASE,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
    };

// Cảnh báo sớm khi thiếu cấu hình, thay vì để lỗi khó hiểu lúc query
if (!databaseUrl) {
  const missing = ["DB_DATABASE", "DB_USER", "DB_PASSWORD"].filter(
    (key) => !process.env[key]
  );
  if (missing.length > 0) {
    console.warn(
      `⚠️ Thiếu cấu hình database: ${missing.join(", ")}. ` +
        "Đặt DATABASE_URL hoặc các biến DB_* trong .env"
    );
  }
}

let postgresPool;
function getPostgresPool() {
  if (!postgresPool) {
    const { Pool } = require("pg");
    postgresPool = new Pool({ ...poolConfig, max: 10, idleTimeoutMillis: 30000 });
    postgresPool.on("connect", () => console.log("✅ Connected to PostgreSQL database"));
    postgresPool.on("error", (err) => console.error("❌ PostgreSQL pool error:", err));
  }
  return postgresPool;
}

function getD1() {
  const db = requestDatabase.getStore() || cloudflareBindings?.DB;
  if (!db) throw new Error("D1 database chưa được gắn vào request");
  return db;
}

function translateQuery(text, values = []) {
  let sql = text
    .replace(/::(?:FLOAT|NUMERIC|INTEGER|TEXT|UUID|BOOLEAN|TIMESTAMPTZ|TIMESTAMP)/gi, "")
    .replace(/NOW\(\)/gi, "CURRENT_TIMESTAMP")
    .replace(/CURRENT_TIMESTAMP\s*\+\s*make_interval\(mins\s*=>\s*\$(\d+)\)/gi, (_match, index) => `datetime('now', '+' || $${index} || ' minutes')`)
    .replace(/CURRENT_TIMESTAMP\s*-\s*INTERVAL\s*'([0-9]+) days'/gi, (_match, days) => `datetime('now', '-${days} days')`)
    .replace(/ILIKE/gi, "LIKE")
    .replace(/([\w.]+)\s*~\s*'\^\[0-9\]\{2\}:\[0-9\]\{2\}:\[0-9\]\{2\}\$'/g, "$1 GLOB '[0-9][0-9]:[0-9][0-9]:[0-9][0-9]'")
    .replace(/([\w.]+)\s*~\s*'\^\[0-9\]\{2\}:\[0-9\]\{2\}\$'/g, "$1 GLOB '[0-9][0-9]:[0-9][0-9]'")
    .replace(/\s+NULLS\s+LAST\b/gi, "");
  sql = sql.replace(
    /([\w."()]+)\s*=\s*ANY\(\$(\d+)(?:::[\w\[\]]+)?\)/gi,
    (_match, column, indexText) => {
      const index = Number(indexText) - 1;
      const items = Array.isArray(values[index]) ? values[index] : [];
      return items.length
        ? `${column} IN (__D1_ARRAY_${index}__)`
        : "0 = 1";
    }
  );
  const bindings = [];
  sql = sql.replace(/\$(\d+)|__D1_ARRAY_(\d+)__/g, (_match, scalarIndex, arrayIndex) => {
    if (arrayIndex !== undefined) {
      const items = values[Number(arrayIndex)] || [];
      if (items.length === 0) return "(NULL)";
      bindings.push(...items);
      return `(${items.map(() => "?").join(", ")})`;
    }
    bindings.push(values[Number(scalarIndex) - 1]);
    return "?";
  });
  return { sql, values: bindings };
}

async function d1Query(text, values = []) {
  const db = getD1();
  if (/CASE\s+WHEN\s+xmax\s*=\s*0/i.test(text)) {
    const exists = await db
      .prepare("SELECT 1 FROM lesson_progress WHERE user_uid = ? AND course_id = ? AND lesson_id = ?")
      .bind(values[0], values[1], values[2])
      .first();
    text = text.replace(
      /CASE\s+WHEN\s+xmax\s*=\s*0\s+THEN\s+'INSERT'\s+ELSE\s+'UPDATE'\s+END\s+AS\s+action/i,
      `'${exists ? "UPDATE" : "INSERT"}' AS action`
    );
  }
  const { sql, values: bindings } = translateQuery(text, values);
  const statement = db.prepare(sql).bind(...bindings.map(normalizeD1Binding));
  if (/^\s*(SELECT|PRAGMA|WITH)\b/i.test(sql) || /\bRETURNING\b/i.test(sql)) {
    const result = await statement.all();
    const rows = (result.results || []).map(normalizeD1Row);
    return {
      rows,
      rowCount: result.meta?.changes ?? rows.length,
      meta: result.meta,
    };
  }
  const result = await statement.run();
  return { rows: [], rowCount: result.meta?.changes || 0, meta: result.meta };
}

const pool = {
  query(text, values = []) {
    return requestDatabase.getStore() || cloudflareBindings?.DB
      ? d1Query(text, values)
      : getPostgresPool().query(text, values);
  },
  connect() {
    if (!requestDatabase.getStore() && !cloudflareBindings?.DB) return getPostgresPool().connect();
    throw new Error("pool.connect() cần được thay bằng batch() trên D1");
  },
  async batch(queries) {
    const db = requestDatabase.getStore() || cloudflareBindings?.DB;
    if (!db) {
      const client = await getPostgresPool().connect();
      try {
        await client.query("BEGIN");
        const results = [];
        for (const query of queries) results.push(await client.query(query.text, query.values));
        await client.query("COMMIT");
        return results;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    }
    const prepared = queries.map(({ text, values = [] }) => {
      const translated = translateQuery(text, values);
      return db.prepare(translated.sql).bind(...translated.values.map(normalizeD1Binding));
    });
    return db.batch(prepared);
  },
};

function withDatabase(db, callback) {
  return requestDatabase.run(db, callback);
}

function setCloudflareBindings(bindings) {
  cloudflareBindings = bindings;
}

module.exports = { pool, withDatabase, setCloudflareBindings, translateQuery };
