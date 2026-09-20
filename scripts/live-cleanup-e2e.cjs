/** Dọn dẹp rác do test E2E để lại: user test (Firebase + DB) và dữ liệu liên quan. */
require("dotenv").config();
const admin = require("../src/config/firebase.config");
const { Pool } = require("pg");
(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  // mọi user có email bắt đầu bằng E2E-
  const rows = (await pool.query("select uid,email from users where email like 'E2E-%'")).rows;
  console.log("user test trong DB:", rows.length);
  for (const r of rows) {
    await pool.query("delete from upgrade_requests where user_uid=$1", [r.uid]);
    await pool.query("delete from notifications where uid=$1", [r.uid]);
    await pool.query("delete from enrollments where user_uid=$1", [r.uid]);
    await pool.query("delete from bookmarks where user_uid=$1", [r.uid]);
    await pool.query("delete from course_reviews where user_uid=$1", [r.uid]);
    await pool.query("delete from lesson_progress where user_uid=$1", [r.uid]);
    await pool.query("delete from quiz_results where user_uid=$1", [r.uid]);
    await pool.query("delete from users where uid=$1", [r.uid]);
    console.log("  đã xoá DB:", r.email);
    try { await admin.auth().deleteUser(r.uid); console.log("  đã xoá Firebase:", r.uid); }
    catch (e) { console.log("  Firebase:", e.code || e.message.split("\n")[0]); }
  }
  // rác khác của test
  for (const [l, q] of [
    ["upgrade_requests còn lại", "delete from upgrade_requests"],
    ["notifications còn lại", "delete from notifications"],
    ["quiz_results còn lại", "delete from quiz_results"],
  ]) { const r = await pool.query(q); if (r.rowCount) console.log(`  ${l}: ${r.rowCount}`); }
  console.log("\n--- counts ---");
  const c = await pool.query(`select 'users' t,count(*)::int n from users union all select 'courses',count(*)::int from courses union all select 'lessons',count(*)::int from lessons union all select 'quizzes',count(*)::int from quizzes union all select 'quiz_questions',count(*)::int from quiz_questions union all select 'course_categories',count(*)::int from course_categories union all select 'enrollments',count(*)::int from enrollments union all select 'notifications',count(*)::int from notifications union all select 'quiz_results',count(*)::int from quiz_results order by t`);
  c.rows.forEach(x => console.log("  " + x.t.padEnd(18) + x.n));
  await pool.end();
})();
