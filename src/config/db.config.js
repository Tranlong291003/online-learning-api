const { Pool } = require("pg");
require("dotenv").config();

const useSsl = process.env.DB_SSL === "true";

// DATABASE_URL rỗng ("" hoặc chỉ khoảng trắng) phải được coi là chưa cấu hình,
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

const pool = new Pool({
  ...poolConfig,
  max: 10,
  idleTimeoutMillis: 30000,
});

// Test connection on startup
pool.on("connect", () => {
  console.log("✅ Connected to PostgreSQL database");
});

pool.on("error", (err) => {
  console.error("❌ PostgreSQL pool error:", err);
});

module.exports = { pool };
