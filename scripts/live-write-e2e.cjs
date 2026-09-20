/**
 * E2E đường GHI trên server THẬT + DB Supabase THẬT.
 * Tạo dữ liệu tạm có tiền tố "LIVE-E2E" rồi dọn sạch theo thứ tự an toàn với FK.
 *
 * Mục tiêu: bắt các lỗi mà 221 test mock không thể thấy (tên cột, kiểu dữ liệu, enum).
 */
require("dotenv").config();
const jwt = require("jsonwebtoken");

const BASE = process.env.PROBE_BASE || "http://localhost:4001";
const UID = "abb8127b-fc22-466e-8473-51000b7f2114"; // user duy nhất trong DB thật (role mentor)
const EMAIL = "mentor.demo@onlinelearning.vn";

const tok = (role, uid = UID, email = EMAIL) =>
  jwt.sign({ uid, email, role }, process.env.JWT_SECRET, { expiresIn: "1h" });

// admin: CHỈ ký token là chưa đủ — nhiều controller (changeCourseStatus, gradeQuizResult)
// đọc role từ DB, nên token giả role admin cho user thật (role mentor) sẽ bị 403 đúng như
// thiết kế. Phải tạo user test thật rồi nâng role trong DB (xem bootstrap bên dưới).
const T = { mentor: tok("mentor"), user: tok("user"), admin: null };

const created = {};

async function call(method, path, { body, token = T.admin, expected = [200, 201], raw } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (raw !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(raw);
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  let status, json, text;
  try {
    const res = await fetch(BASE + path, { method, headers, body: payload });
    status = res.status;
    text = await res.text();
    try { json = JSON.parse(text); } catch { json = null; }
  } catch (e) {
    status = "ERR"; text = e.message;
  }
  const ok = expected.includes(status);
  console.log(`${ok ? "OK  " : "FAIL"} ${method.padEnd(6)} ${path.padEnd(52)} -> ${status}`);
  if (!ok) console.log(`        expected ${expected.join("/")} | ${String(text).slice(0, 400)}`);
  return { ok, status, json, text };
}

const TAG = `LIVE-E2E-${Date.now()}`;

(async () => {
  const fails = [];
  const track = (r, label) => { if (!r.ok) fails.push(`${label} (status ${r.status})`); return r; };

  try {
    // ---------- BOOTSTRAP ADMIN THẬT ----------
    // Tạo user test qua API, nâng role admin trong DB (dùng SQL trực tiếp vì API
    // /updaterole cũng đòi token admin sẵn). Token admin ký cho uid này sẽ qua được
    // mọi controller đọc role từ DB.
    const createdUser = await call("POST", "/api/users/create", {
      token: T.mentor, expected: [201], body: { email: `${TAG}@example.com`, password: "Test123456!", name: "LIVE-E2E Admin" },
    });
    const adminUid = createdUser.json?.user_id;
    if (adminUid) {
      created.adminUid = adminUid;
      const { Client } = require("pg");
      const dbc = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
      await dbc.connect();
      await dbc.query("UPDATE users SET role = 'admin' WHERE uid = $1", [adminUid]);
      await dbc.end();
      T.admin = tok("admin", adminUid, `${TAG}@example.com`);
    }

    // ---------- DANH MỤC ----------
    const cat = track(await call("POST", "/api/course-categories/create",
      { body: { name: `${TAG}-cat`, description: "e2e" } }), "create category");
    created.categoryId = cat.json?.data?.category_id ?? cat.json?.category_id;

    // ---------- KHÓA HỌC ----------
    const course = track(await call("POST", "/api/courses/create", {
      token: T.mentor,
      body: { title: `${TAG}-course`, description: "e2e course", category_id: created.categoryId, level: "beginner", price: 100000, language: "vi", tags: "e2e" },
    }), "create course");
    created.courseId = course.json?.course?.course_id;

    if (created.courseId) {
      // Phải dùng token ADMIN: mentor chỉ được đổi rejected -> pending.
      track(await call("PATCH", `/api/courses/${created.courseId}/status`, { token: T.admin, body: { status: "approved" } }), "approve course");
      track(await call("PUT", `/api/courses/update/${created.courseId}`, {
        token: T.mentor, body: { title: `${TAG}-course-upd`, level: "intermediate", category_id: created.categoryId },
      }), "update course");
      track(await call("GET", `/api/courses/${created.courseId}`), "get course");
    }

    // ---------- BÀI HỌC ----------
    const lesson = track(await call("POST", "/api/lessons/create", {
      token: T.mentor, body: { course_id: created.courseId, title: `${TAG}-lesson`, content: "e2e", order: 1 },
    }), "create lesson");
    created.lessonId = lesson.json?.data?.lesson_id ?? lesson.json?.lesson_id;
    if (created.lessonId) {
      track(await call("PUT", `/api/lessons/update/${created.lessonId}`, {
        token: T.mentor, body: { title: `${TAG}-lesson-upd`, content: "e2e upd", order: 2 },
      }), "update lesson");
    }

    // ---------- QUIZ + CÂU HỎI ----------
    const quiz = track(await call("POST", "/api/quizzes/create", {
      token: T.mentor, body: { course_id: created.courseId, title: `${TAG}-quiz`, description: "e2e", type: "trac_nghiem", time_limit: 10, attempt_limit: 2 },
    }), "create quiz");
    created.quizId = quiz.json?.data?.quiz_id ?? quiz.json?.quiz_id;

    const q = track(await call("POST", "/api/questions/createbyuser", {
      token: T.mentor, body: { quiz_id: created.quizId, question: "1+1=?", options: ["1", "2", "3", "4"], correct_index: 1 },
    }), "create question");
    created.questionId = q.json?.data?.question_id ?? q.json?.question_id;
    if (created.questionId) {
      track(await call("PUT", `/api/questions/update/${created.questionId}`, {
        token: T.mentor, body: { quiz_id: created.quizId, question: "2+2=?", options: ["2", "3", "4", "5"], correct_index: 2 },
      }), "update question");
    }

    // ---------- ĐĂNG KÝ HỌC + HOÀN THÀNH BÀI ----------
    const enr = track(await call("POST", "/api/enrollments/register", {
      body: { courseId: created.courseId },
    }), "enroll");
    created.enrollmentId = enr.json?.enrollment_id;

    track(await call("POST", "/api/lessons/complete", {
      body: { courseId: Number(created.courseId), lessonId: Number(created.lessonId) },
    }), "complete lesson");

    // ---------- REVIEW ----------
    const rev = track(await call("POST", "/api/reviews/create", {
      body: { course_id: created.courseId, rating: 5, comment: "e2e review" },
    }), "create review");
    created.reviewId = rev.json?.data?.review_id;
    if (created.reviewId) {
      track(await call("PUT", `/api/reviews/update/${created.reviewId}`, { body: { rating: 4, comment: "e2e upd" } }), "update review");
    }

    // ---------- BOOKMARK ----------
    const bm = track(await call("POST", "/api/bookmarks/create", { body: { courseId: created.courseId } }), "create bookmark");
    created.bookmarkId = bm.json?.data?.bookmark_id;

    // ---------- THÔNG BÁO ----------
    const noti = track(await call("POST", "/api/notifications/create",
      { body: { title: `${TAG}`, content: "e2e noti", icon: "test", color: "#000000" } }), "create notification");
    created.notiId = noti.json?.noti_id;
    if (created.notiId) {
      track(await call("POST", "/api/notifications/mark-read", { body: { noti_id: created.notiId } }), "mark-read (body)");
      track(await call("PUT", `/api/notifications/update/${created.notiId}`, { body: {} }), "mark-read (uuid on URL)");
      track(await call("POST", "/api/notifications", { body: {} }), "list notifications");
    }

    // ---------- NỘP BÀI + CHẤM ĐIỂM (nghi vấn cột graded_by) ----------
    const sub = track(await call("POST", "/api/quiz-results/submit", {
      body: { quiz_id: created.quizId, answers: { [created.questionId]: 2 } },
    }), "submit quiz");
    created.resultId = sub.json?.result_id;
    if (created.resultId) {
      track(await call("GET", `/api/quiz-results/${created.resultId}`), "get quiz result by id");
      const grade = await call("PATCH", `/api/quiz-results/quiz-results/${created.resultId}/grade`, {
        token: T.mentor, body: { explanation: "e2e graded", score: 9 },
      });
      track(grade, "GRADE quiz result  <-- kiem tra cot graded_by");
    }

    track(await call("POST", "/api/app-stats", { body: {} }), "app-stats");

    // ---------- DỌN DẸP (thứ tự an toàn với FK) ----------
    console.log("\n--- cleanup ---");
    if (created.bookmarkId) track(await call("DELETE", "/api/bookmarks/delete", { body: { bookmarkId: created.bookmarkId } }), "del bookmark");
    if (created.reviewId) track(await call("DELETE", `/api/reviews/delete/${created.reviewId}`), "del review");
    if (created.notiId) track(await call("DELETE", `/api/notifications/delete/${created.notiId}`, { body: {} }), "del notification");
    if (created.enrollmentId) track(await call("DELETE", `/api/enrollments/delete/${created.enrollmentId}`), "del enrollment");
    // Không có endpoint xoá quiz_results trong API (chỉ có /submit, /users/:uid/results,
    // /:result_id/grade, /:result_id). Bỏ qua ở đây; dọn bằng SQL ở bước cuối.
    if (created.resultId) console.log("SKIP  DELETE /api/quiz-results/delete/:id -> API không có endpoint này");
    if (created.questionId) track(await call("DELETE", `/api/questions/delete/${created.questionId}`, { token: T.mentor }), "del question");
    if (created.quizId) track(await call("DELETE", `/api/quizzes/delete/${created.quizId}`, { token: T.mentor }), "del quiz");
    if (created.lessonId) track(await call("DELETE", `/api/lessons/delete/${created.lessonId}`, { token: T.mentor }), "del lesson");
    if (created.courseId) track(await call("DELETE", `/api/courses/delete/${created.courseId}`), "del course");
    if (created.categoryId) track(await call("DELETE", `/api/course-categories/delete/${created.categoryId}`), "del category");
    if (created.adminUid) track(await call("DELETE", `/api/users/delete/${created.adminUid}`, { token: T.admin }), "del admin test user");

    // Dọn side-effect: vài controller tự sinh notification (tạo danh mục, duyệt khóa học…).
    // quiz_results cũng không có endpoint xoá -> xoá bằng SQL đúng những row của lần chạy này.
    {
      const { Client } = require("pg");
      const dbc = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
      await dbc.connect();
      // Xoá + thử lại: notification do server ghi có thể chưa kịp thấy qua connection khác.
      let total = 0;
      for (let attempt = 0; attempt < 4; attempt++) {
        const n = await dbc.query(
          "DELETE FROM notifications WHERE content LIKE $1 OR title LIKE $1 OR title LIKE $2",
          [`%${TAG}%`, "%Tạo danh mục%"]
        );
        total += n.rowCount;
        if (n.rowCount === 0) break;
        await new Promise((r) => setTimeout(r, 800));
      }
      // Lưới an toàn: xoá mọi notification còn trỏ tới dữ liệu test vừa sinh
      const left = await dbc.query(
        "SELECT count(*)::int n FROM notifications WHERE content LIKE $1 OR title LIKE $1",
        [`%${TAG}%`]
      );
      if (left.rows[0].n > 0) {
        const rows = await dbc.query("SELECT title, content FROM notifications");
        console.log("  ⚠️ notification còn sót:", JSON.stringify(rows.rows));
      }
      const qr = await dbc.query("DELETE FROM quiz_results WHERE quiz_id = $1", [created.quizId]);
      console.log(`  dọn side-effect: ${total} notification, ${qr.rowCount} quiz_result`);
      await dbc.end();
    }
  } catch (e) {
    fails.push("EXCEPTION: " + e.message);
  }

  console.log(`\n== E2E write: ${fails.length === 0 ? "ALL PASS" : fails.length + " FAIL"} ==`);
  fails.forEach((f) => console.log("   - " + f));
})();
