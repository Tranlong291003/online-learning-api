const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
require("dotenv").config();

function createPool() {
  const useSsl = process.env.DB_SSL === "true";

  if (process.env.DATABASE_URL) {
    return new Pool({
      connectionString: process.env.DATABASE_URL,
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

async function main() {
  const schemaPath = path.join(__dirname, "..", "database_postgres.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf8");
  const pool = createPool();

  try {
    await pool.query(schemaSql);
    console.log("PostgreSQL schema initialized successfully.");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("PostgreSQL schema initialization failed:", error.message);
  process.exit(1);
});
