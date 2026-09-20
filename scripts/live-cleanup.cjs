/**
 * ⚠️ CẢNH BÁO: script này XOÁ DỮ LIỆU trong DB thật (DB Supabase, không phải mock).
 *
 * Nó dọn dữ liệu do live-write-e2e.cjs / live-write-sweep.cjs tạo ra, nhưng hiện
 * đang xoá TOÀN BỘ bảng notifications / lesson_progress / enrollments / bookmarks /
 * upgrade_requests / quiz_results — kể cả dữ liệu không phải của test.
 *
 * CHỈ chạy trên DB dev/demo. KHÔNG chạy trên DB có dữ liệu thật của người dùng.
 */
const fs=require("fs");const {Client}=require("pg");

// ---------------------------------------------------------------------------
// RÀO CHẮN BẮT BUỘC.
// Script này xoá TOÀN BỘ nhiều bảng (không có WHERE), nên một lần chạy nhầm trên
// DB production là mất sạch dữ liệu người dùng. Yêu cầu phải gõ đúng tên DB để xác nhận.
// ---------------------------------------------------------------------------
const DB_TEN_DU_KIEN = "postgres.hgugynckgityoacmqpcj"; // DB dev/demo của đồ án
const dbUser = process.argv[2];
if (dbUser !== DB_TEN_DU_KIEN) {
  console.error("\n❌ DỪNG LẠI — script này XOÁ TOÀN BỘ nhiều bảng, không có WHERE.\n");
  console.error("   Để chạy, phải xác nhận đúng tên DB bằng cách gõ lại nó:");
  console.error(`\n     node scripts/live-cleanup.cjs ${DB_TEN_DU_KIEN}\n`);
  console.error("   ⚠️  KHÔNG chạy trên DB production.\n");
  process.exit(1);
}

const pw=decodeURIComponent(new URL(fs.readFileSync(".env","utf8").match(/^DATABASE_URL=(.*)$/m)[1].trim()).password);
(async()=>{
const c=new Client({host:"aws-0-ap-northeast-1.pooler.supabase.com",port:5432,database:"postgres",
 user:"postgres.hgugynckgityoacmqpcj",password:pw,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:10000});
await c.connect();
await c.query("BEGIN");
const del=async(l,s,p)=>{const r=await c.query(s,p);console.log("  "+l+": "+r.rowCount+" rows");};
// quiz_results của quiz test (36) và mọi result mồ côi của user
await del("quiz_results(course100 via quiz 36 / orphan)","delete from quiz_results where quiz_id in (select quiz_id from quizzes where course_id=100) or result_id in (select result_id from quiz_results r where not exists (select 1 from quizzes q where q.quiz_id=r.quiz_id and q.course_id<>100) and quiz_id in (36))");
await del("quiz_results all (chỉ còn row test)","delete from quiz_results");
await del("quiz_questions quiz36","delete from quiz_questions where quiz_id in (select quiz_id from quizzes where course_id=100)");
await del("quizzes course100","delete from quizzes where course_id=100");
await del("course_reviews course100","delete from course_reviews where course_id=100");
await del("lessons course100","delete from lessons where course_id=100");
await del("courses LIVE-E2E","delete from courses where title like 'LIVE-E2E%'");
await del("categories LIVE-E2E","delete from course_categories where name like 'LIVE-E2E%'");
await del("notifications (toàn bộ, đều là rác test)","delete from notifications");
await del("lesson_progress (rác test)","delete from lesson_progress");
await del("enrollments (rác test)","delete from enrollments");
await del("bookmarks (rác test)","delete from bookmarks");
await del("upgrade_requests (rác test)","delete from upgrade_requests");
await c.query("COMMIT");
console.log("\n--- counts sau khi dọn ---");
const r=await c.query(`select 'courses' t,count(*)::int n from courses union all select 'lessons',count(*)::int from lessons union all select 'quizzes',count(*)::int from quizzes union all select 'quiz_questions',count(*)::int from quiz_questions union all select 'quiz_results',count(*)::int from quiz_results union all select 'enrollments',count(*)::int from enrollments union all select 'notifications',count(*)::int from notifications union all select 'bookmarks',count(*)::int from bookmarks union all select 'course_reviews',count(*)::int from course_reviews union all select 'lesson_progress',count(*)::int from lesson_progress union all select 'course_categories',count(*)::int from course_categories order by t`);
r.rows.forEach(x=>console.log("  "+x.t.padEnd(20)+x.n));
await c.end();})().catch(e=>console.log("ERR:",e.message.split("\n")[0]));
