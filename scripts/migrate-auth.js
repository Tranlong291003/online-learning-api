/**
 * Chạy migration schema cho tính năng xác thực trên DB đã tồn tại.
 *
 * Vì sao cần file riêng thay vì chỉ dùng `database_postgres.sql`:
 * file schema dùng `CREATE TABLE IF NOT EXISTS`, nên với bảng `users` đã có sẵn
 * thì câu đó là no-op — các CỘT mới (password_hash, id, failed_login_attempts...)
 * sẽ không bao giờ được thêm. Migration này bù đúng phần thiếu đó.
 *
 * Idempotent: chạy lại nhiều lần vô hại.
 *
 *   npm run db:migrate:auth
 */
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
require("dotenv").config();

function createPool() {
  const useSsl = process.env.DB_SSL === "true";

  const databaseUrl = (process.env.DATABASE_URL || "").trim();
  if (databaseUrl) {
    return new Pool({
      connectionString: databaseUrl,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
    });
  }

  const required = ["DB_HOST", "DB_DATABASE", "DB_USER", "DB_PASSWORD"];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required DB env vars: ${missing.join(", ")}`);
  }

  return new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
  });
}

/** Kiểm tra các cột/bảng mà code xác thực thực sự cần đã tồn tại chưa. */
async function verify(pool) {
  const columns = await pool.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'users'`
  );
  const names = new Set(columns.rows.map((r) => r.column_name));

  const requiredColumns = [
    "id",
    "password_hash",
    "failed_login_attempts",
    "locked_until",
  ];
  const missingColumns = requiredColumns.filter((c) => !names.has(c));

  const tables = await pool.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name IN ('refresh_tokens', 'password_resets')`
  );
  const tableNames = new Set(tables.rows.map((r) => r.table_name));
  const missingTables = ["refresh_tokens", "password_resets"].filter(
    (t) => !tableNames.has(t)
  );

  return { missingColumns, missingTables };
}

async function main() {
  const pool = createPool();
  const migrationPath = path.join(
    __dirname,
    "migrations",
    "001_auth_schema.sql"
  );

  try {
    const sql = fs.readFileSync(migrationPath, "utf8");
    console.log("Đang chạy migration:", path.basename(migrationPath));
    await pool.query(sql);

    const { missingColumns, missingTables } = await verify(pool);

    if (missingColumns.length > 0 || missingTables.length > 0) {
      console.error("❌ Migration chạy xong nhưng vẫn thiếu:");
      if (missingColumns.length) console.error("   cột:", missingColumns.join(", "));
      if (missingTables.length) console.error("   bảng:", missingTables.join(", "));
      process.exit(1);
    }

    console.log("✅ Migration xác thực hoàn tất. Cột và bảng cần thiết đã đủ.");

    const users = await pool.query(
      "SELECT COUNT(*)::int AS total, COUNT(password_hash)::int AS with_password FROM users"
    );
    const { total, with_password: withPassword } = users.rows[0];
    console.log(
      `   users: ${total} dòng, ${withPassword} dòng đã có mật khẩu.`
    );
    if (total > withPassword) {
      console.log(
        `   ⚠️ ${total - withPassword} tài khoản chưa có mật khẩu (tạo trước khi API tự quản lý` +
          " đăng nhập). Những tài khoản này cần đặt lại mật khẩu qua /api/auth/forgot-password."
      );
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("❌ Migration thất bại:", error.message);
  process.exit(1);
});
