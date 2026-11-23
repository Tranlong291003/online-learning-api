const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { Client } = require("pg");
require("dotenv").config();

const outputPath = process.argv[2];
if (!outputPath || !process.env.DATABASE_URL) {
  console.error("Cần DATABASE_URL và đường dẫn file SQLite đích chưa tồn tại.");
  process.exit(1);
}

const schema = fs.readFileSync(path.join(__dirname, "../cloudflare/d1-schema.sql"), "utf8");
const quote = (value) => `"${value.replaceAll('"', '""')}"`;

function sqliteValue(value) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "boolean") return Number(value);
  return value;
}

async function main() {
  const fd = fs.openSync(outputPath, "wx", 0o600);
  fs.closeSync(fd);
  let db;
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
  });

  try {
    db = new DatabaseSync(outputPath);
    db.exec(schema);
    await client.connect();
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all();
    db.exec("BEGIN; PRAGMA defer_foreign_keys = ON");

    for (const { name } of tables) {
      const columns = db.prepare(`PRAGMA table_info(${quote(name)})`).all().map((column) => column.name);
      const source = await client.query(`SELECT ${columns.map(quote).join(", ")} FROM public.${quote(name)}`);
      const insert = db.prepare(`INSERT INTO ${quote(name)} (${columns.map(quote).join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`);
      for (const row of source.rows) insert.run(...columns.map((column) => sqliteValue(row[column])));
      console.log(`Đã sao chép ${source.rowCount} dòng vào ${name}`);
    }

    const violations = db.prepare("PRAGMA foreign_key_check").all();
    if (violations.length) throw new Error(`Dữ liệu có ${violations.length} lỗi khóa ngoại`);
    db.exec("COMMIT");
    await client.query("COMMIT");
    console.log("Đã tạo snapshot SQLite và kiểm tra khóa ngoại.");
  } catch (error) {
    if (db?.isTransaction) db.exec("ROLLBACK");
    console.error("Không tạo được snapshot:", error.message);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
    db?.close();
    if (process.exitCode) fs.unlinkSync(outputPath);
  }
}

main().catch((error) => {
  console.error("Không tạo được snapshot:", error.message);
  process.exitCode = 1;
});
