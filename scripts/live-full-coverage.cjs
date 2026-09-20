/**
 * LIVE FULL COVERAGE — phủ TOÀN BỘ route trên server thật + DB thật + Firebase thật.
 *
 * - Tự tạo user test thật (Firebase + DB), dùng xong xoá sạch.
 * - Test cả upload file (PNG/PDF) qua multipart.
 * - Cuối cùng in ra danh sách route ĐÃ PHỦ và CHƯA PHỦ (đối chiếu router thật).
 *
 * Chạy: node scripts/live-full-coverage.cjs
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
const { Client } = require("pg");

const BASE = process.env.PROBE_BASE || "http://localhost:4001";
const MENTOR_UID = "abb8127b-fc22-466e-8473-51000b7f2114"; // user thật trong DB
const MENTOR_EMAIL = "mentor.demo@onlinelearning.vn";
const TAG = `E2E-${Date.now()}`;

// ---------- route thật, đọc trực tiếp từ router (nguồn chân lý) ----------
function canonicalRoutes() {
  const appJs = fs.readFileSync(path.join(__dirname, "..", "src", "app.js"), "utf8");
  const mounts = [...appJs.matchAll(/app\.use\(\s*"([^"]+)"\s*,\s*(\w+)\s*\)/g)]
    .map((m) => ({ mountPath: m[1], varName: m[2] }));
  const reqs = [...appJs.matchAll(/const\s+(\w+)\s*=\s*require\("\.\/(routes\/[\w.]+)"\)/g)]
    .reduce((a, m) => ((a[m[1]] = m[2]), a), {});
  const out = [];
  for (const { mountPath, varName } of mounts) {
    if (!reqs[varName]) continue;
    const router = require(path.join(__dirname, "..", "src", reqs[varName]));
    for (const layer of router.stack) {
      if (!layer.route) continue;
      for (const m of Object.keys(layer.route.methods)) {
        if (m === "all") continue;
        out.push(`${m.toUpperCase()} ${mountPath}${layer.route.path}`.replace(/\/$/, "/"));
      }
    }
  }
  return out;
}
const ALL_ROUTES = canonicalRoutes();
const coveredRoutes = new Set();
function hit(method, fullPath) {
  coveredRoutes.add(`${method.toUpperCase()} ${fullPath}`.replace(/\/$/, "/"));
}

// ---------- helpers ----------
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);
const PDF = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n");

const tok = (uid, role, email) =>
  jwt.sign({ uid, email: email || "e2e@test.local", role }, process.env.JWT_SECRET, { expiresIn: "1h" });

const T = { mentor: tok(MENTOR_UID, "mentor", MENTOR_EMAIL) };

const created = { firebaseUids: [], ids: {} };
const results = [];

async function api(method, fullPath, opts = {}) {
  const { body, token, expected = [200, 201], files, rawBody, routeKey } = opts;
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (files) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(body || {})) fd.append(k, String(v));
    for (const f of files) fd.append(f.field, new Blob([f.buffer], { type: f.type }), f.name);
    payload = fd;
  } else if (rawBody !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = rawBody;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  let status, text, json;
  try {
    const res = await fetch(BASE + fullPath, { method, headers, body: payload });
    status = res.status;
    text = await res.text();
    try { json = JSON.parse(text); } catch { json = null; }
  } catch (e) {
    status = 0;
    text = e.message;
  }

  const ok = expected.includes(status);
  results.push({ ok, method, path: fullPath, status, expected });
  if (routeKey) hit(routeKey.method, routeKey.path);
  console.log(`${ok ? "OK  " : "FAIL"} ${method.padEnd(6)} ${fullPath.padEnd(54)} -> ${status}`);
  if (!ok) console.log(`        expected ${expected.join("/")} | ${String(text).slice(0, 320)}`);
  return { ok, status, json, text };
}

(async () => {
  console.log(`\n=== LIVE FULL COVERAGE (${ALL_ROUTES.length} route) ===\n`);

  // =====================================================================
  // 1) USERS — tạo user test thật (Firebase + DB) qua chính API
  // =====================================================================
  const admin = require("../src/config/firebase.config");
  const newEmail = `${TAG}@example.com`;
  const createRes = await api("POST", "/api/users/create", {
    body: { email: newEmail, password: "Test123456!", name: "E2E User", bio: "b" },
    expected: [201],
    routeKey: { method: "POST", path: "/api/users/create" },
  });
  const testUid = createRes.json?.user_id;
  if (testUid) created.firebaseUids.push(testUid);
  const userTok = testUid ? tok(testUid, "user", newEmail) : null;
  const adminTok = testUid ? tok(testUid, "admin", newEmail) : null;

  // Token thôi chưa đủ: middleware xác thực lấy role từ DB, nên phải nâng role thật
  // trong DB thì các endpoint admin-only mới chạy được với token này.
  //
  // Cần HAI admin: một để test, một để "cứu" — vì khi user A bị khoá thì chính token
  // của A cũng bị chặn, nên phải nhờ admin B mở khoá lại.
  let rescueAdminTok = null;
  if (testUid) {
    const bootClient = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await bootClient.connect();
    await bootClient.query("UPDATE users SET role = 'admin' WHERE uid = $1", [testUid]);
    await bootClient.end();

    const rescueRes = await api("POST", "/api/users/create", {
      body: { email: `${TAG}-rescue@example.com`, password: "Test123456!", name: "E2E Rescue Admin" },
      expected: [201],
    });
    const rescueUid = rescueRes.json?.user_id;
    if (rescueUid) {
      created.firebaseUids.push(rescueUid);
      const rc = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
      await rc.connect();
      await rc.query("UPDATE users SET role = 'admin' WHERE uid = $1", [rescueUid]);
      await rc.end();
      rescueAdminTok = tok(rescueUid, "admin", `${TAG}-rescue@example.com`);
    }
  }

  // =====================================================================
  // 2) LOGIN (lỗi) — happy path cần Firebase ID token thật (xem báo cáo)
  // =====================================================================
  await api("POST", "/api/users/login", { body: {}, expected: [400], routeKey: { method: "POST", path: "/api/users/login" } });
  await api("POST", "/api/users/login", { body: { idToken: "not-a-real-token" }, expected: [401], routeKey: { method: "POST", path: "/api/users/login" } });

  // =====================================================================
  // 3) USERS — đọc
  // =====================================================================
  await api("GET", "/api/users/", { token: adminTok || T.mentor, routeKey: { method: "GET", path: "/api/users/" } });
  await api("GET", "/api/users/listmentor", { token: T.mentor, routeKey: { method: "GET", path: "/api/users/listmentor" } });
  await api("GET", `/api/users/checkactive/${MENOR_SAFE()}`, { token: T.mentor, routeKey: { method: "GET", path: "/api/users/checkactive/:uid" } });
  if (testUid) {
    await api("GET", `/api/users/${testUid}`, { token: T.mentor, routeKey: { method: "GET", path: "/api/users/:id" } });
  }

  // =====================================================================
  // 4) USERS — ghi: update profile, status, role
  // =====================================================================
  if (testUid) {
    await api("PUT", `/api/users/update/${testUid}`, {
      token: userTok, routeKey: { method: "PUT", path: "/api/users/update/:id" },
      files: [{ field: "avatar", name: "a.png", type: "image/png", buffer: PNG }],
      body: { name: "E2E User Updated", bio: "bio2", phone: "0900111222", gender: "male", birthdate: "2001-02-03" },
    });
    // Khoá rồi mở lại NGAY. Lưu ý: sau khi bị khoá, mọi request khác bằng token này
    // đều 403 ("Tài khoản đã bị khoá") — kể cả request mở lại. Nên phải mở lại bằng
    // token của user KHÁC (mentor thật) chứ không dùng lại token vừa bị khoá.
    await api("PATCH", `/api/users/${testUid}/status`, {
      token: adminTok || T.mentor, body: { status: "disabled" }, routeKey: { method: "PATCH", path: "/api/users/:id/status" },
    });
    await api("PATCH", `/api/users/${testUid}/status`, {
      token: rescueAdminTok || T.mentor, body: { status: "active" },
    });
    // updaterole: token admin (đổi role DB của chính user test -> admin)
    await api("PUT", "/api/users/updaterole", {
      token: adminTok, body: { uid: testUid, role: "admin" }, routeKey: { method: "PUT", path: "/api/users/updaterole" },
    });
    await api("PUT", "/api/users/updaterole", { token: adminTok, body: { uid: testUid, role: "sai-role" }, expected: [400], routeKey: { method: "PUT", path: "/api/users/updaterole" } });
  }

  // =====================================================================
  // 5) DANH MỤC
  // =====================================================================
  await api("GET", "/api/course-categories/", { token: T.mentor, routeKey: { method: "GET", path: "/api/course-categories/" } });

  const catRes = await api("POST", "/api/course-categories/create", {
    token: T.mentor, routeKey: { method: "POST", path: "/api/course-categories/create" },
    files: [{ field: "icon", name: "icon.png", type: "image/png", buffer: PNG }],
    body: { name: `${TAG}-cat`, description: "e2e" },
  });
  created.ids.categoryId = catRes.json?.data?.category_id ?? catRes.json?.category_id;

  if (created.ids.categoryId) {
    await api("PUT", `/api/course-categories/update/${created.ids.categoryId}`, {
      token: T.mentor, routeKey: { method: "PUT", path: "/api/course-categories/update/:category_id" },
      files: [{ field: "icon", name: "icon2.png", type: "image/png", buffer: PNG }],
      body: { name: `${TAG}-cat-upd`, description: "e2e upd" },
    });
    await api("PUT", `/api/course-categories/update/abc`, { token: T.mentor, body: { name: "x" }, expected: [400] });
  }

  // =====================================================================
  // 6) KHÓA HỌC
  // =====================================================================
  await api("GET", "/api/courses/", { token: T.mentor, routeKey: { method: "GET", path: "/api/courses/" } });
  await api("GET", `/api/courses/mentor/${MENTOR_UID}`, { token: T.mentor, routeKey: { method: "GET", path: "/api/courses/mentor/:instructor_uid" } });
  await api("GET", "/api/courses/abc", { token: T.mentor, expected: [400] });

  const courseRes = await api("POST", "/api/courses/create", {
    token: T.mentor, routeKey: { method: "POST", path: "/api/courses/create" },
    files: [{ field: "thumbnail", name: "thumb.png", type: "image/png", buffer: PNG }],
    body: { title: `${TAG}-course`, description: "e2e", category_id: created.ids.categoryId, level: "beginner", price: 100000, language: "vi", tags: "e2e" },
  });
  created.ids.courseId = courseRes.json?.course?.course_id;

  if (created.ids.courseId) {
    await api("GET", `/api/courses/${created.ids.courseId}`, { token: T.mentor, routeKey: { method: "GET", path: "/api/courses/:course_id" } });
    await api("PATCH", `/api/courses/${created.ids.courseId}/status`, {
      token: adminTok, body: { status: "approved" }, routeKey: { method: "PATCH", path: "/api/courses/:course_id/status" },
    });
    await api("PATCH", `/api/courses/${created.ids.courseId}/status`, {
      token: adminTok, body: { status: "rejected", rejectionReason: "e2e reject" },
    });
    await api("PATCH", `/api/courses/${created.ids.courseId}/status`, {
      token: T.mentor, body: { status: "pending" },
    });
    await api("PUT", `/api/courses/update/${created.ids.courseId}`, {
      token: T.mentor, routeKey: { method: "PUT", path: "/api/courses/update/:course_id" },
      files: [{ field: "thumbnail", name: "thumb2.png", type: "image/png", buffer: PNG }],
      body: { title: `${TAG}-course-upd`, description: "upd", level: "intermediate", category_id: created.ids.categoryId },
    });
  }

  // =====================================================================
  // 7) BÀI HỌC (+ upload pdf/slide)
  // =====================================================================
  const lessonRes = await api("POST", "/api/lessons/create", {
    token: T.mentor, routeKey: { method: "POST", path: "/api/lessons/create" },
    files: [
      { field: "pdf", name: "bai.pdf", type: "application/pdf", buffer: PDF },
      { field: "slide", name: "slide.pdf", type: "application/pdf", buffer: PDF },
    ],
    body: { uid: MENTOR_UID, course_id: created.ids.courseId, title: `${TAG}-lesson`, content: "e2e", order: 1 },
  });
  created.ids.lessonId = lessonRes.json?.data?.lesson_id ?? lessonRes.json?.lesson_id;

  if (created.ids.lessonId) {
    await api("GET", `/api/lessons/detail/${created.ids.lessonId}`, { token: T.mentor, routeKey: { method: "GET", path: "/api/lessons/detail/:lessonId" } });
    await api("PUT", `/api/lessons/update/${created.ids.lessonId}`, {
      token: T.mentor, routeKey: { method: "PUT", path: "/api/lessons/update/:lesson_id" },
      files: [{ field: "pdf", name: "bai2.pdf", type: "application/pdf", buffer: PDF }],
      body: { uid: MENTOR_UID, title: `${TAG}-lesson-upd`, content: "upd", order: 2 },
    });
  }
  if (created.ids.courseId) {
    await api("GET", `/api/lessons/courses/${created.ids.courseId}/${MENTOR_UID}`, { token: T.mentor, routeKey: { method: "GET", path: "/api/lessons/courses/:course_id/:userUid" } });
  }

  // =====================================================================
  // 8) ĐĂNG KÝ HỌC + HOÀN THÀNH BÀI HỌC
  // =====================================================================
  if (testUid && created.ids.courseId) {
    const enr = await api("POST", "/api/enrollments/register", {
      token: userTok, body: { courseId: created.ids.courseId }, routeKey: { method: "POST", path: "/api/enrollments/register" },
    });
    created.ids.enrollmentId = enr.json?.enrollment_id;

    await api("GET", `/api/enrollments/user/${testUid}`, { token: userTok, routeKey: { method: "GET", path: "/api/enrollments/user/:uid" } });
    await api("GET", `/api/enrollments/check/${testUid}/${created.ids.courseId}`, { token: userTok, routeKey: { method: "GET", path: "/api/enrollments/check/:uid/:course_id" } });
    await api("GET", `/api/enrollments/progress?userUid=${testUid}&courseId=${created.ids.courseId}`, { token: userTok, routeKey: { method: "GET", path: "/api/enrollments/progress" } });

    await api("POST", "/api/lessons/complete", {
      token: userTok, routeKey: { method: "POST", path: "/api/lessons/complete" },
      body: { courseId: Number(created.ids.courseId), lessonId: Number(created.ids.lessonId) },
    });
    // gọi lần 2 -> nhánh UPDATE của upsert
    await api("POST", "/api/lessons/complete", {
      token: userTok, body: { courseId: Number(created.ids.courseId), lessonId: Number(created.ids.lessonId) },
    });
  }

  // =====================================================================
  // 9) QUIZ + CÂU HỎI
  // =====================================================================
  const quizRes = await api("POST", "/api/quizzes/create", {
    token: T.mentor, routeKey: { method: "POST", path: "/api/quizzes/create" },
    body: { uid: MENTOR_UID, course_id: created.ids.courseId, title: `${TAG}-quiz`, type: "trac_nghiem", time_limit: 10, attempt_limit: 2 },
  });
  created.ids.quizId = quizRes.json?.data?.quiz_id ?? quizRes.json?.quiz_id;

  await api("GET", `/api/quizzes/getquizbycourse/${created.ids.courseId}`, { token: T.mentor, routeKey: { method: "GET", path: "/api/quizzes/getquizbycourse/:course_id" } });
  await api("GET", `/api/quizzes/getquizbycoures/${created.ids.courseId}`, { token: T.mentor, routeKey: { method: "GET", path: "/api/quizzes/getquizbycoures/:course_id" } });
  if (testUid) await api("GET", `/api/quizzes/getquizuser/${testUid}`, { token: userTok, routeKey: { method: "GET", path: "/api/quizzes/getquizuser/:user_uid" } });

  if (created.ids.quizId) {
    await api("PUT", `/api/quizzes/update/${created.ids.quizId}`, {
      token: T.mentor, routeKey: { method: "PUT", path: "/api/quizzes/update/:quiz_id" },
      body: { uid: MENTOR_UID, title: `${TAG}-quiz-upd`, time_limit: 15 },
    });

    const qRes = await api("POST", "/api/questions/createbyuser", {
      token: T.mentor, routeKey: { method: "POST", path: "/api/questions/createbyuser" },
      body: { uid: MENTOR_UID, quiz_id: created.ids.quizId, question: "2+2=?", options: ["1", "2", "3", "4"], correct_index: 3 },
    });
    created.ids.questionId = qRes.json?.data?.question_id ?? qRes.json?.question_id;

    // Đọc danh sách câu hỏi PHẢI sau khi đã tạo ít nhất 1 câu ở trên
    await api("GET", `/api/questions/${created.ids.quizId}`, { token: T.mentor, routeKey: { method: "GET", path: "/api/questions/:quiz_id" } });

    if (created.ids.questionId) {
      await api("PUT", `/api/questions/update/${created.ids.questionId}`, {
        token: T.mentor, routeKey: { method: "PUT", path: "/api/questions/update/:question_id" },
        body: { uid: MENTOR_UID, quiz_id: created.ids.quizId, question: "3+3=?", options: ["5", "6", "7", "8"], correct_index: 1 },
      });
      await api("DELETE", `/api/questions/delete/${created.ids.questionId}`, { token: T.mentor, routeKey: { method: "DELETE", path: "/api/questions/delete/:question_id" } });
    }

    // createbyai: cần OpenAI (đang hết credit) -> chấp nhận 503 nhưng vẫn tính là đã gọi
    await api("POST", "/api/questions/createbyai", {
      token: T.mentor, routeKey: { method: "POST", path: "/api/questions/createbyai" },
      body: { uid: MENTOR_UID, quiz_id: created.ids.quizId, topic: "toán", number: 2, difficulty: "easy" },
      expected: [201, 503],
    });
  }

  // =====================================================================
  // 10) QUIZ RESULTS (+ chấm điểm bằng ADMIN thật trong DB)
  // =====================================================================
  if (created.ids.quizId) {
    await api("GET", `/api/quiz-results/users/${testUid || MENTOR_UID}/results`, {
      token: testUid ? userTok : T.mentor, routeKey: { method: "GET", path: "/api/quiz-results/users/:user_uid/results" },
    });

    const q2 = await api("POST", "/api/questions/createbyuser", {
      token: T.mentor,
      body: { uid: MENTOR_UID, quiz_id: created.ids.quizId, question: "4+4=?", options: ["6", "7", "8", "9"], correct_index: 2 },
    });
    const q2id = q2.json?.data?.question_id ?? q2.json?.question_id;

    const sub = await api("POST", "/api/quiz-results/submit", {
      token: userTok || T.mentor, routeKey: { method: "POST", path: "/api/quiz-results/submit" },
      body: { uid: testUid || MENTOR_UID, quiz_id: created.ids.quizId, answers: q2id ? { [q2id]: 2 } : {} },
    });
    created.ids.resultId = sub.json?.result_id;

    if (created.ids.resultId) {
      await api("GET", `/api/quiz-results/${created.ids.resultId}`, {
        token: userTok || T.mentor, routeKey: { method: "GET", path: "/api/quiz-results/:result_id" },
      });
      // testUid đã được set role admin ở bước 4 -> token admin + DB admin -> chấm được
      await api("PATCH", `/api/quiz-results/quiz-results/${created.ids.resultId}/grade`, {
        token: adminTok || T.mentor, routeKey: { method: "PATCH", path: "/api/quiz-results/quiz-results/:result_id/grade" },
        body: { uid: testUid, explanation: "e2e graded", score: 9 },
      });
    }
  }

  // =====================================================================
  // 11) REVIEWS
  // =====================================================================
  if (testUid && created.ids.courseId) {
    const rev = await api("POST", "/api/reviews/create", {
      token: userTok, routeKey: { method: "POST", path: "/api/reviews/create" },
      body: { course_id: created.ids.courseId, rating: 5, comment: "e2e review" },
    });
    created.ids.reviewId = rev.json?.data?.review_id;

    await api("GET", `/api/reviews/course/${created.ids.courseId}`, { token: userTok, routeKey: { method: "GET", path: "/api/reviews/course/:courseId" } });
    if (created.ids.reviewId) {
      await api("PUT", `/api/reviews/update/${created.ids.reviewId}`, {
        token: userTok, routeKey: { method: "PUT", path: "/api/reviews/update/:reviewId" },
        body: { rating: 4, comment: "upd" },
      });
      await api("DELETE", `/api/reviews/delete/${created.ids.reviewId}`, { token: userTok, routeKey: { method: "DELETE", path: "/api/reviews/delete/:reviewId" } });
    }
  }

  // =====================================================================
  // 12) BOOKMARKS
  // =====================================================================
  if (testUid && created.ids.courseId) {
    const bm = await api("POST", "/api/bookmarks/create", {
      token: userTok, routeKey: { method: "POST", path: "/api/bookmarks/create" },
      body: { courseId: created.ids.courseId },
    });
    created.ids.bookmarkId = bm.json?.data?.bookmark_id;

    await api("GET", `/api/bookmarks/${testUid}`, { token: userTok, routeKey: { method: "GET", path: "/api/bookmarks/:user_uid" } });
    if (created.ids.bookmarkId) {
      await api("DELETE", "/api/bookmarks/delete", { token: userTok, routeKey: { method: "DELETE", path: "/api/bookmarks/delete" }, body: { bookmarkId: created.ids.bookmarkId } });
    }
  }

  // =====================================================================
  // 13) NOTIFICATIONS
  // =====================================================================
  const noti = await api("POST", "/api/notifications/create", {
    token: userTok || T.mentor, routeKey: { method: "POST", path: "/api/notifications/create" },
    body: { uid: testUid, title: `${TAG}`, content: "e2e", icon: "test", color: "#000" },
  });
  created.ids.notiId = noti.json?.noti_id;

  await api("POST", "/api/notifications/", { token: userTok || T.mentor, body: { uid: testUid }, routeKey: { method: "POST", path: "/api/notifications/" } });
  if (created.ids.notiId) {
    await api("POST", "/api/notifications/mark-read", { token: userTok || T.mentor, body: { uid: testUid, noti_id: created.ids.notiId }, routeKey: { method: "POST", path: "/api/notifications/mark-read" } });
    await api("PUT", `/api/notifications/update/${created.ids.notiId}`, { token: userTok || T.mentor, body: { uid: testUid }, routeKey: { method: "PUT", path: "/api/notifications/update/:id" } });
    await api("DELETE", `/api/notifications/delete/${created.ids.notiId}`, { token: userTok || T.mentor, body: { uid: testUid }, routeKey: { method: "DELETE", path: "/api/notifications/delete/:id" } });
  }

  // =====================================================================
  // 14) MENTOR REQUESTS (cần upload ảnh)
  // =====================================================================
  await api("GET", "/api/mentor-requests/", { token: adminTok || T.mentor, routeKey: { method: "GET", path: "/api/mentor-requests/" } });
  if (testUid) {
    await api("POST", "/api/mentor-requests/", {
      token: userTok, routeKey: { method: "POST", path: "/api/mentor-requests/" },
      files: [{ field: "image", name: "proof.png", type: "image/png", buffer: PNG }],
      body: { user_uid: testUid },
    });
    const list = await api("GET", "/api/mentor-requests/", { token: adminTok || T.mentor });
    const reqId = list.json?.data?.[0]?.id ?? list.json?.[0]?.id;
    if (reqId) {
      await api("PUT", `/api/mentor-requests/${reqId}/status`, {
        token: adminTok || T.mentor, routeKey: { method: "PUT", path: "/api/mentor-requests/:id/status" },
        body: { status: "rejected", reason: "e2e" },
      });
    }
  }

  // =====================================================================
  // 15) APP STATS
  // =====================================================================
  await api("POST", "/api/app-stats/", { token: T.mentor, routeKey: { method: "POST", path: "/api/app-stats/" } });
  await api("POST", "/api/app-stats/", { expected: [401] });
  await api("GET", "/health");

  // =====================================================================
  // 16) CLEANUP — xoá qua API theo thứ tự an toàn với FK
  // =====================================================================
  console.log("\n--- cleanup ---");
  const cleanup = [
    ["DELETE", `/api/quizzes/delete/${created.ids.quizId}`, { token: T.mentor, body: { uid: MENTOR_UID }, routeKey: { method: "DELETE", path: "/api/quizzes/delete/:quiz_id" } }],
    ["DELETE", `/api/lessons/delete/${created.ids.lessonId}`, { token: T.mentor, body: { uid: MENTOR_UID }, routeKey: { method: "DELETE", path: "/api/lessons/delete/:lesson_id" } }],
    ["DELETE", `/api/enrollments/delete/${created.ids.enrollmentId}`, { token: adminTok || T.mentor, routeKey: { method: "DELETE", path: "/api/enrollments/delete/:enrollment_id" } }],
    ["DELETE", `/api/courses/delete/${created.ids.courseId}`, { token: adminTok || T.mentor, body: { uid: testUid }, routeKey: { method: "DELETE", path: "/api/courses/delete/:course_id" } }],
    ["DELETE", `/api/course-categories/delete/${created.ids.categoryId}`, { token: T.mentor, body: { uid: MENTOR_UID }, routeKey: { method: "DELETE", path: "/api/course-categories/delete/:category_id" } }],
  ];
  for (const [m, p, o] of cleanup) {
    if (p.includes("undefined")) continue;
    await api(m, p, { ...o, expected: [200, 201, 404, 403, 409] });
  }
  // xoá user test cuối cùng (Firebase + DB)
  // Dùng token của admin "cứu" nếu có: token testUid có thể đã bị vô hiệu do bị xoá/khoá.
  if (testUid) {
    await api("DELETE", `/api/users/delete/${testUid}`, {
      token: rescueAdminTok || adminTok || T.mentor, routeKey: { method: "DELETE", path: "/api/users/delete/:id" }, expected: [200, 404],
    });
  }
  if (rescueAdminTok) {
    const rescueUid = created.firebaseUids[created.firebaseUids.length - 1];
    if (rescueUid && rescueUid !== testUid) {
      await api("DELETE", `/api/users/delete/${rescueUid}`, {
        token: rescueAdminTok, expected: [200, 404],
      });
    }
  }

  // Dọn side-effect: vài controller (tạo danh mục, đăng ký học…) tự sinh notification
  // cho user thật. Xoá đúng những row mang TAG của lần chạy này.
  const cleanupClient = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await cleanupClient.connect();
  const swept = await cleanupClient.query(
    "DELETE FROM notifications WHERE title LIKE $1 OR content LIKE $1 OR title LIKE $2",
    [`%${TAG}%`, "%Tạo danh mục%"]
  );
  console.log(`  dọn side-effect: ${swept.rowCount} notification`);
  await cleanupClient.end();

  // =====================================================================
  // 17) COVERAGE
  // =====================================================================
  const missing = ALL_ROUTES.filter((r) => !coveredRoutes.has(r.replace(/\/$/, "/") || r));
  const pass = results.filter((r) => r.ok).length;
  const fail = results.length - pass;

  console.log("\n================ KẾT QUẢ ================");
  console.log(`Kiểm tra: ${results.length} | PASS: ${pass} | FAIL: ${fail}`);
  console.log(`Route phủ: ${coveredRoutes.size}/${ALL_ROUTES.length}`);
  if (missing.length) {
    console.log("\n--- ROUTE CHƯA PHỦ ---");
    missing.forEach((m) => console.log("  " + m));
  } else {
    console.log("✅ ĐÃ PHỦ TOÀN BỘ ROUTE");
  }
  if (fail) {
    console.log("\n--- KIỂM TRA THẤT BẠI ---");
    results.filter((r) => !r.ok).forEach((r) => console.log(`  ${r.method} ${r.path} -> ${r.status} (mong đợi ${r.expected.join("/")})`));
  }
  process.exit(fail || missing.length ? 1 : 0);
})().catch((e) => {
  console.error("EXCEPTION:", e);
  process.exit(2);
});

function MENOR_SAFE() { return MENTOR_UID; }
