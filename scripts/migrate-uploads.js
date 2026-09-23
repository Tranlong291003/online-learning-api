/**
 * Tạo bảng `uploaded_files` trên DB đã tồn tại.
 *
 * Vì sao cần file riêng thay vì chỉ dùng `database_postgres.sql`:
 * file schema dùng `CREATE TABLE IF NOT EXISTS` và chỉ chạy được từ đầu; DB
 * production đang chạy cần thêm đúng một bảng mới.
 *
 * Bối cảnh: file upload trước đây ghi ra `src/public/uploads/`. Trên Vercel
 * (serverless) mã nguồn ở thư mục chỉ đọc nên mọi upload trả 500, và kể cả khi
 * ghi được thì đĩa cũng là tạm thời. Bảng này giữ nội dung file để API phục vụ
 * lại qua `GET /uploads/*`.
 *
 * Idempotent: chạy lại nhiều lần vô hại.
 *
 *   npm run db:migrate:uploads
 */
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
require("dotenv").config();

/** Giá trị còn nguyên trong file mẫu — chưa được thay bằng thông tin thật. */
const PLACEHOLDERS = [
  "MAT_KHAU_DB",
  "YOUR-PASSWORD",
  "your_postgres_password",
  "MẬT_KHẨU",
];

function createPool() {
  const useSsl = process.env.DB_SSL === "true";
  const databaseUrl = (process.env.DATABASE_URL || "").trim();

  // Bắt lỗi "quên điền mật khẩu" trước khi thử kết nối. Nếu để nguyên, Supabase
  // trả về lỗi DNS khó hiểu (tenant/user not found) khiến khó đoán nguyên nhân.
  if (databaseUrl) {
    const found = PLACEHOLDERS.find((p) => databaseUrl.includes(p));
    if (found) {
      throw new Error(
        `DATABASE_URL vẫn còn giá trị mẫu "${found}". Mở file .env và thay bằng ` +
          "chuỗi kết nối thật (Supabase → Project Settings → Database → Connection string → URI)."
      );
    }
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

/** Xác nhận bảng và các cột mà tầng lưu trữ file thực sự cần đã có. */
async function verify(pool) {
  const columns = await pool.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'uploaded_files'`
  );
  const names = new Set(columns.rows.map((r) => r.column_name));
  const required = [
    "file_id",
    "public_path",
    "mime_type",
    "size_bytes",
    "content",
  ];
  return required.filter((c) => !names.has(c));
}

async function main() {
  const pool = createPool();
  const migrationPath = path.join(
    __dirname,
    "migrations",
    "002_uploaded_files.sql"
  );

  try {
    const sql = fs.readFileSync(migrationPath, "utf8");
    console.log("Đang chạy migration:", path.basename(migrationPath));
    await pool.query(sql);

    const missing = await verify(pool);
    if (missing.length > 0) {
      console.error("❌ Migration chạy xong nhưng vẫn thiếu cột:", missing.join(", "));
      process.exit(1);
    }

    const count = await pool.query("SELECT COUNT(*)::int AS n FROM uploaded_files");
    console.log("✅ Bảng uploaded_files sẵn sàng.");
    console.log(`   Hiện có ${count.rows[0].n} file trong CSDL.`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("❌ Migration thất bại:", error.message);
  process.exit(1);
});
