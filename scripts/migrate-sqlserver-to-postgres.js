const mssql = require("mssql");
const { Pool } = require("pg");
require("dotenv").config();

const batchSize = Number(process.env.MIGRATION_BATCH_SIZE || 500);

const sourceConfig = {
  server: process.env.SOURCE_DB_SERVER,
  port: Number(process.env.SOURCE_DB_PORT || 1433),
  database: process.env.SOURCE_DB_DATABASE,
  user: process.env.SOURCE_DB_USER,
  password: process.env.SOURCE_DB_PASSWORD,
  options: {
    encrypt: process.env.SOURCE_DB_ENCRYPT === "true",
    trustServerCertificate: process.env.SOURCE_DB_TRUST_CERT === "true",
  },
};

const targetConfig = {
  ...(process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT || 5432),
        database: process.env.DB_DATABASE,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
      }),
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
};

const tableOrder = [
  "users",
  "course_categories",
  "courses",
  "lessons",
  "enrollments",
  "quizzes",
  "quiz_questions",
  "quiz_results",
  "notifications",
  "lesson_progress",
  "course_reviews",
  "bookmarks",
  "upgrade_requests",
];

const sourceTableByTarget = {
  upgrade_requests: "user_requests",
};

const numericIdentityColumns = new Set([
  "category_id",
  "course_id",
  "lesson_id",
  "enrollment_id",
  "quiz_id",
  "question_id",
  "result_id",
  "noti_id",
  "review_id",
  "bookmark_id",
  "id",
]);

function validateEnv() {
  const required = [
    "SOURCE_DB_SERVER",
    "SOURCE_DB_DATABASE",
    "SOURCE_DB_USER",
    "SOURCE_DB_PASSWORD",
  ];

  if (!process.env.DATABASE_URL) {
    required.push("DB_HOST", "DB_DATABASE", "DB_USER", "DB_PASSWORD");
  }

  const missing = required.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

function sanitizeText(value) {
  return value.replace(/\u0000/g, "");
}

function mapValue(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return sanitizeText(value);
  if (value instanceof Date) return value;
  if (Buffer.isBuffer(value)) return sanitizeText(value.toString("utf8"));
  return value;
}

function mapRecord(record) {
  const mapped = {};
  for (const key of Object.keys(record)) {
    mapped[key] = mapValue(record[key]);
  }
  return mapped;
}

function quoteIdentifier(identifier) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function quoteSqlServerIdentifier(identifier) {
  return `[${identifier.replace(/]/g, "]]")}]`;
}

function buildInsertQuery(table, row) {
  const columns = Object.keys(row);
  const placeholders = columns.map((_, index) => `$${index + 1}`);
  const values = columns.map((column) => row[column]);
  const query = `INSERT INTO ${quoteIdentifier(table)} (${columns
    .map(quoteIdentifier)
    .join(", ")}) VALUES (${placeholders.join(", ")})`;
  return { query, values };
}

async function filterExistingTables(pgPool) {
  const result = await pgPool.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
  );
  const existing = new Set(result.rows.map((row) => row.table_name));
  return tableOrder.filter((table) => existing.has(table));
}

async function resetSequence(pgPool, table, column) {
  await pgPool.query(
    `SELECT setval(
      pg_get_serial_sequence($1, $2),
      COALESCE((SELECT MAX(${quoteIdentifier(column)}) FROM ${quoteIdentifier(table)}), 1),
      true
    )`,
    [table, column]
  );
}

async function migrateTable(sqlPool, pgPool, table) {
  const sourceTable = sourceTableByTarget[table] || table;
  const result = await sqlPool.request().query(`SELECT * FROM ${quoteSqlServerIdentifier(sourceTable)}`);
  const rows = result.recordset.map(mapRecord);

  await pgPool.query(`TRUNCATE TABLE ${quoteIdentifier(table)} RESTART IDENTITY CASCADE`);

  if (rows.length === 0) {
    console.log(`- ${table}: 0 rows`);
    return;
  }

  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize);
    const client = await pgPool.connect();
    try {
      await client.query("BEGIN");
      for (const row of batch) {
        const { query, values } = buildInsertQuery(table, row);
        await client.query(query, values);
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  const firstRow = rows[0];
  for (const column of Object.keys(firstRow)) {
    if (numericIdentityColumns.has(column)) {
      try {
        await resetSequence(pgPool, table, column);
      } catch (error) {
        // Ignore tables that do not use serial/identity sequence on this column.
      }
      break;
    }
  }

  console.log(`- ${table}: ${rows.length} rows`);
}

async function main() {
  validateEnv();

  const sqlPool = await mssql.connect(sourceConfig);
  const pgPool = new Pool(targetConfig);

  try {
    const tables = await filterExistingTables(pgPool);
    for (const table of tables) {
      await migrateTable(sqlPool, pgPool, table);
    }
    console.log("Migration completed.");
  } finally {
    await sqlPool.close();
    await pgPool.end();
  }
}

main().catch((error) => {
  console.error("Migration failed:", error.message);
  process.exit(1);
});
