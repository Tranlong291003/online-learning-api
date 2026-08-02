const { Pool } = require("pg");
require("dotenv").config();

const useSsl = process.env.DB_SSL === "true";
const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: useSsl ? { rejectUnauthorized: false } : false,
      }
    : {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT || 5432),
        database: process.env.DB_DATABASE,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        ssl: useSsl ? { rejectUnauthorized: false } : false,
      }
);

const tables = [
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

const integrityQueries = [
  {
    name: "courses_without_user_or_category",
    sql: `
      SELECT COUNT(*)::int AS count
      FROM courses c
      LEFT JOIN users u ON u.uid = c.instructor_uid
      LEFT JOIN course_categories cc ON cc.category_id = c.category_id
      WHERE u.uid IS NULL OR cc.category_id IS NULL
    `,
  },
  {
    name: "lessons_without_course",
    sql: `
      SELECT COUNT(*)::int AS count
      FROM lessons l
      LEFT JOIN courses c ON c.course_id = l.course_id
      WHERE c.course_id IS NULL
    `,
  },
  {
    name: "quiz_results_without_user_or_quiz",
    sql: `
      SELECT COUNT(*)::int AS count
      FROM quiz_results qr
      LEFT JOIN users u ON u.uid = qr.user_uid
      LEFT JOIN quizzes q ON q.quiz_id = qr.quiz_id
      WHERE u.uid IS NULL OR q.quiz_id IS NULL
    `,
  },
];

async function verifyTables() {
  for (const table of tables) {
    const result = await pool.query(`SELECT COUNT(*)::int AS count FROM ${table}`);
    console.log(`- ${table}: ${result.rows[0].count}`);
  }
}

async function verifyIntegrity() {
  for (const item of integrityQueries) {
    const result = await pool.query(item.sql);
    const count = result.rows[0].count;
    console.log(`- ${item.name}: ${count}`);
  }
}

async function main() {
  try {
    await verifyTables();
    await verifyIntegrity();
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Verification failed:", error.message);
  process.exit(1);
});
