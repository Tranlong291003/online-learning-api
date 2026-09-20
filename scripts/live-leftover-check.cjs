require("dotenv").config();
const admin = require("../src/config/firebase.config");
const { Pool } = require("pg");
(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const u = await pool.query("select id,uid,email,role::text,is_active from users order by id");
  console.log("### users trong DB (" + u.rows.length + ")");
  u.rows.forEach(x => console.log("  " + JSON.stringify(x)));
  console.log("\n### rác E2E còn lại:");
  for (const [t, q] of [
    ["courses", "select course_id,title from courses where title like 'E2E-%'"],
    ["categories", "select category_id,name from course_categories where name like 'E2E-%'"],
    ["lessons", "select lesson_id,title from lessons where title like 'E2E-%'"],
    ["quizzes", "select quiz_id,title from quizzes where title like 'E2E-%'"],
    ["upgrade_requests", "select id,user_uid,status::text from upgrade_requests"],
    ["quiz_results", "select result_id,user_uid from quiz_results"],
  ]) {
    const r = await pool.query(q);
    if (r.rows.length) { console.log("  " + t + ":"); r.rows.forEach(x => console.log("     " + JSON.stringify(x))); }
  }
  // firebase orphans
  console.log("\n### Firebase users khớp E2E:");
  try {
    const list = await admin.auth().listUsers(1000);
    const orphans = list.users.filter(x => (x.email || "").startsWith("E2E-"));
    orphans.forEach(x => console.log("  " + x.uid + " | " + x.email));
    if (!orphans.length) console.log("  (không có)");
  } catch (e) { console.log("  lỗi list:", e.message.split("\n")[0]); }
  await pool.end();
})();
