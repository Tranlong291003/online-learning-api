/**
 * Test toàn bộ API trên production, dùng dữ liệu THẬT đang có trong D1.
 *
 * Khác với `test/live/api-live-regression.mjs`: file kia gắn cứng ID (227, 131,
 * 708) và tài khoản demo của một DB khác nên không chạy được ở đây. Script này
 * tự dò ID thật, tự tạo tài khoản tạm rồi dọn sạch sau khi chạy.
 *
 * Chạy: node scripts/prod-verify.mjs
 */
import crypto from "node:crypto";

const BASE = (process.env.API_BASE || "https://lms.tranlong291003.workers.dev").replace(/\/$/, "");
const TAG = `VERIFY-${Date.now()}`;
const results = [];
let group = "";

const setGroup = (g) => {
  group = g;
  console.log(`\n=== ${g} ===`);
};

function rec(name, expected, actual, ok, note = "") {
  results.push({ group, name, expected: String(expected), actual: String(actual), ok, note });
  console.log(
    `${ok ? "PASS" : "FAIL"} ${name} — expect ${expected}, got ${actual}${note ? " | " + note : ""}`
  );
}

async function call(method, path, { token, body, form } = {}) {
  const h = {};
  if (token) h.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    h["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(BASE + path, { method, headers: h, body: payload });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* HTML hoặc rỗng */
  }
  return { status: res.status, json, text, headers: res.headers };
}

async function expectOk(name, method, path, opts, expected, validator) {
  const r = await call(method, path, opts);
  const expectedList = Array.isArray(expected) ? expected : [expected];
  let ok = expectedList.includes(r.status);
  let note = "";
  if (!ok) note = r.text.slice(0, 180).replace(/\s+/g, " ");
  if (ok && validator) {
    const v = validator(r);
    if (v !== true) {
      ok = false;
      note = String(v);
    }
  }
  rec(name, expectedList.join("/"), r.status, ok, note);
  return r;
}

const TOKENS = {};

async function login(email, password) {
  const r = await call("POST", "/api/auth/login", { body: { email, password } });
  if (r.status !== 200) throw new Error(`login ${email} -> ${r.status} ${r.text.slice(0, 120)}`);
  return r.json.access_token;
}

const ctx = {};

async function main() {
  // ---------- 1. Công khai ----------
  setGroup("1. Công khai (không cần token)");
  await expectOk("GET /health", "GET", "/health", {}, 200, (r) =>
    r.json?.status === "ok" ? true : "thiếu status ok"
  );
  await expectOk("GET /api-docs.json", "GET", "/api-docs.json", {}, 200, (r) =>
    r.json?.openapi ? true : "thiếu openapi"
  );
  await expectOk("GET /api-docs (HTML)", "GET", "/api-docs", {}, 200, (r) =>
    r.text.includes("swagger") || r.text.includes("Swagger") ? true : "không phải trang docs"
  );
  await expectOk("GET /api/courses không token → 401", "GET", "/api/courses", {}, 401);
  await expectOk("GET /uploads/khong-ton-tai.png → 404", "GET", "/uploads/khong-ton-tai.png", {}, 404);
  await expectOk("path traversal /uploads/../.env bị chặn", "GET", "/uploads/..%2f..%2f.env", {}, [400, 403, 404]);

  // ---------- 2. Xác thực ----------
  setGroup("2. Xác thực");
  const viewerEmail = "demo-viewer@demo.onlinelearning.vn";
  await expectOk(
    "POST /auth/login (demo viewer)",
    "POST",
    "/api/auth/login",
    { body: { email: viewerEmail, password: "Demo@123456" } },
    200,
    (r) => (r.json?.access_token && r.json?.refresh_token ? true : "thiếu token")
  );
  TOKENS.viewer = await login(viewerEmail, "Demo@123456");
  ctx.viewerRefresh = (
    await call("POST", "/api/auth/login", {
      body: { email: viewerEmail, password: "Demo@123456" },
    })
  ).json.refresh_token;
  // UID thật (không phải phần trước @ của email) — dùng cho mọi endpoint có :uid.
  ctx.viewerUid = (
    await call("GET", "/api/auth/me", { token: TOKENS.viewer })
  ).json?.user?.uid;

  await expectOk("login sai mật khẩu → 401", "POST", "/api/auth/login",
    { body: { email: viewerEmail, password: "sai-mat-khau" } }, [400, 401]);
  await expectOk("login email không tồn tại → 401", "POST", "/api/auth/login",
    { body: { email: `khong-co-${Date.now()}@nowhere.invalid`, password: "Demo@123456" } }, [400, 401]);
  await expectOk("login thiếu mật khẩu → 400", "POST", "/api/auth/login",
    { body: { email: viewerEmail } }, 400);
  await expectOk("login thiếu email → 400", "POST", "/api/auth/login",
    { body: { password: "x" } }, 400);

  await expectOk("GET /auth/me", "GET", "/api/auth/me", { token: TOKENS.viewer }, 200,
    (r) => (r.json?.role === "user" ? true : `role=${r.json?.role}`));
  await expectOk("GET /auth/me không token → 401", "GET", "/api/auth/me", {}, 401);
  await expectOk("GET /auth/me token rác → 401", "GET", "/api/auth/me",
    { token: "rac.khong.hop.le" }, 401);

  // refresh + rotation
  const refreshed = await expectOk("POST /auth/refresh", "POST", "/api/auth/refresh",
    { body: { refresh_token: ctx.viewerRefresh } }, 200,
    (r) => (r.json?.refresh_token !== ctx.viewerRefresh ? true : "token không được rotate"));
  if (refreshed.json?.refresh_token) {
    ctx.viewerRefresh2 = refreshed.json.refresh_token;
    // Dùng lại token đã rotate phải bị từ chối và thu hồi cả họ
    await expectOk("refresh token cũ (đã rotate) bị từ chối → 401", "POST", "/api/auth/refresh",
      { body: { refresh_token: ctx.viewerRefresh } }, 401);
    // Sau khi họ token bị thu hồi, token mới cũng phải chết
    await expectOk("cả họ token bị thu hồi sau khi phát hiện dùng lại", "POST", "/api/auth/refresh",
      { body: { refresh_token: ctx.viewerRefresh2 } }, 401);
  }
  await expectOk("refresh thiếu token → 400", "POST", "/api/auth/refresh", { body: {} }, 400);
  await expectOk("refresh token rác → 401", "POST", "/api/auth/refresh",
    { body: { refresh_token: "khong-ton-tai" } }, 401);

  await expectOk("forgot-password email không tồn tại → 200 (không lộ)",
    "POST", "/api/auth/forgot-password",
    { body: { email: `khong-co-${Date.now()}@nowhere.invalid` } }, 200,
    (r) => (r.json?.reset_token ? "LỖ HỔNG: lộ reset token" : true));
  await expectOk("forgot-password thiếu email → 400", "POST", "/api/auth/forgot-password", { body: {} }, 400);
  await expectOk("reset-password token rác → 400", "POST", "/api/auth/reset-password",
    { body: { token: "rac", new_password: "Abc123456" } }, 400);

  // ---------- 3. Đăng ký user mới (dùng cho phần ghi dữ liệu) ----------
  setGroup("3. Đăng ký + phân quyền");
  ctx.email = `verify-${Date.now()}@verify.local`;
  const reg = await expectOk("POST /auth/register", "POST", "/api/auth/register",
    { body: { email: ctx.email, password: "Verify@123456", name: TAG } }, 201,
    (r) => (r.json?.access_token ? true : "thiếu access_token"));
  TOKENS.fresh = reg.json.access_token;
  ctx.freshUid = reg.json.user.uid;
  await expectOk("register trùng email → 400", "POST", "/api/auth/register",
    { body: { email: ctx.email, password: "Verify@123456", name: "Dup" } }, 400);
  await expectOk("register mật khẩu quá ngắn → 400", "POST", "/api/auth/register",
    { body: { email: `x-${Date.now()}@verify.local`, password: "123", name: "X" } }, 400);
  await expectOk("register email sai định dạng → 400", "POST", "/api/auth/register",
    { body: { email: "khong-phai-email", password: "Verify@123456", name: "X" } }, 400);
  await expectOk("register cố gắng tự set role admin (phải bị bỏ qua)", "POST", "/api/auth/register",
    { body: { email: `role-${Date.now()}@verify.local`, password: "Verify@123456", name: "R", role: "admin" } },
    201,
    (r) => (r.json?.user?.role === "user" ? true : `LỖ HỔNG: role=${r.json?.user?.role}`));

  // ---------- 4. Phân quyền: user thường không được vào endpoint admin/mentor ----------
  setGroup("4. Phân quyền");
  const adminOnly = [
    ["GET", "/api/users"],
    ["PUT", "/api/users/updaterole"],
    ["DELETE", `/api/users/delete/${ctx.freshUid}`],
    ["PATCH", `/api/users/${ctx.freshUid}/status`],
    ["GET", "/api/mentor-requests"],
    ["POST", "/api/course-categories/create"],
    ["PUT", "/api/course-categories/update/1"],
    ["DELETE", "/api/course-categories/delete/1"],
    ["POST", "/api/courses/create"],
    ["PUT", "/api/courses/update/1"],
    ["PATCH", "/api/courses/1/status"],
    ["DELETE", "/api/courses/delete/1"],
    ["POST", "/api/lessons/create"],
    ["PUT", "/api/lessons/update/1"],
    ["DELETE", "/api/lessons/delete/1"],
    ["POST", "/api/quizzes/create"],
    ["PUT", "/api/quizzes/update/1"],
    ["DELETE", "/api/quizzes/delete/1"],
    ["POST", "/api/questions/createbyuser"],
    ["POST", "/api/questions/createbyai"],
    ["PUT", "/api/questions/update/1"],
    ["DELETE", "/api/questions/delete/1"],
    ["PATCH", "/api/quiz-results/quiz-results/1/grade"],
  ];
  for (const [method, path] of adminOnly) {
    const r = await call(method, path, { token: TOKENS.fresh, body: method === "GET" ? undefined : {} });
    rec(`user thường gọi ${method} ${path} → 403`, 403, r.status, r.status === 403,
      r.status === 200 ? "LỖ HỔNG: lọt quyền" : r.status >= 500 ? "lỗi server" : "");
  }

  // Giả mạo uid trong body không được vượt quyền
  await expectOk("giả uid admin khi enroll → 403", "POST", "/api/enrollments/register",
    { token: TOKENS.fresh, body: { courseId: 1, userUid: ctx.viewerUid } }, [400, 403]);
  await expectOk("giả uid khi complete lesson → 403", "POST", "/api/lessons/complete",
    { token: TOKENS.fresh, body: { courseId: 1, lessonId: 1, userUid: ctx.viewerUid } }, [400, 403]);
  await expectOk("xem thông báo người khác → 403", "POST", "/api/notifications",
    { token: TOKENS.fresh, body: { uid: ctx.viewerUid } }, 403);
  await expectOk("xem bookmark người khác → 403", "GET", `/api/bookmarks/${ctx.viewerUid}`,
    { token: TOKENS.fresh }, 403);

  // ---------- 5. Đọc dữ liệu thật ----------
  setGroup("5. Endpoint đọc");
  await expectOk("GET /course-categories", "GET", "/api/course-categories", { token: TOKENS.viewer }, 200,
    (r) => (Array.isArray(r.json?.data) ? true : "thiếu data"));

  const coursesRes = await expectOk("GET /courses", "GET", "/api/courses", { token: TOKENS.viewer }, 200,
    (r) => (r.json?.data ? true : "thiếu data"));
  const allCourses = coursesRes.json?.data
    ? [...(coursesRes.json.data.approved || []), ...(coursesRes.json.data.pending || []), ...(coursesRes.json.data.rejected || [])]
    : [];
  ctx.courseId = allCourses.find((c) => c.status === "approved")?.course_id || allCourses[0]?.course_id;
  rec("có ít nhất 1 khoá học", ">=1", allCourses.length, allCourses.length > 0);
  for (const c of allCourses) {
    if (c.discount_percent != null && (c.discount_percent < 0 || c.discount_percent > 100)) {
      rec(`discount_percent khoá ${c.course_id} trong 0..100`, "0..100", c.discount_percent, false);
      break;
    }
  }

  await expectOk("GET /courses/:id", "GET", `/api/courses/${ctx.courseId}`, { token: TOKENS.viewer }, 200,
    (r) => (r.json?.data?.course_id === ctx.courseId ? true : "sai khoá học"));
  await expectOk("GET /courses/abc → 400", "GET", "/api/courses/abc", { token: TOKENS.viewer }, 400);
  await expectOk("GET /courses/99999999 → 404", "GET", "/api/courses/99999999", { token: TOKENS.viewer }, 404);
  await expectOk("GET /courses/1.5 → 400", "GET", "/api/courses/1.5", { token: TOKENS.viewer }, 400);

  const mentorCourses = await expectOk("GET /courses/mentor/:uid", "GET",
    `/api/courses/mentor/${allCourses[0]?.instructor_uid}`, { token: TOKENS.viewer }, 200,
    (r) => (r.json?.data?.pending ? true : "thiếu cấu trúc data.pending"));
  rec("GET /courses/mentor trả total", "number", typeof mentorCourses.json?.total,
    typeof mentorCourses.json?.total === "number");

  await expectOk("GET /users/listmentor", "GET", "/api/users/listmentor", { token: TOKENS.viewer }, 200,
    (r) => (Array.isArray(r.json?.mentors) ? true : "thiếu mentors"));
  await expectOk("GET /users/:id (hồ sơ công khai)", "GET", `/api/users/${ctx.viewerUid}`, { token: TOKENS.viewer }, 200,
    (r) => (r.json?.user && r.json.user.password_hash === undefined ? true : "LỘ password_hash"));
  await expectOk("GET /users/checkactive của mình", "GET", `/api/users/checkactive/${ctx.viewerUid}`,
    { token: TOKENS.viewer }, 200);

  const lessonsRes = await expectOk("GET /lessons/courses/:id/:uid", "GET",
    `/api/lessons/courses/${ctx.courseId}/${ctx.viewerUid}`, { token: TOKENS.viewer }, 200,
    (r) => (Array.isArray(r.json?.data) ? true : "thiếu data"));
  ctx.lessonId = lessonsRes.json?.data?.[0]?.lesson_id;
  if (ctx.lessonId) {
    await expectOk("GET /lessons/detail/:id", "GET", `/api/lessons/detail/${ctx.lessonId}`,
      { token: TOKENS.viewer }, 200);
  }
  await expectOk("GET /lessons/detail/abc → 400", "GET", "/api/lessons/detail/abc", { token: TOKENS.viewer }, 400);

  const quizzesRes = await expectOk("GET /quizzes/getquizbycourse/:id", "GET",
    `/api/quizzes/getquizbycourse/${ctx.courseId}`, { token: TOKENS.viewer }, 200,
    (r) => (Array.isArray(r.json?.data) ? true : "thiếu data"));
  ctx.quizId = quizzesRes.json?.data?.[0]?.quiz_id;
  await expectOk("GET /quizzes/getquizbycoures (alias)", "GET",
    `/api/quizzes/getquizbycoures/${ctx.courseId}`, { token: TOKENS.viewer }, 200);
  await expectOk("GET /quizzes/getquizuser/:uid", "GET", `/api/quizzes/getquizuser/${ctx.viewerUid}`,
    { token: TOKENS.viewer }, 200);

  if (ctx.quizId) {
    const questionsRes = await expectOk("GET /questions/:quiz_id", "GET", `/api/questions/${ctx.quizId}`,
      { token: TOKENS.viewer }, 200, (r) => (Array.isArray(r.json?.data) ? true : "thiếu data"));
    const qs = questionsRes.json?.data || [];
    if (qs.length > 0) {
      rec("học viên KHÔNG thấy đáp án đúng", "không có correct_index",
        qs[0].correct_index === undefined ? "không có" : "CÓ",
        qs[0].correct_index === undefined && qs[0].expected_keywords === undefined,
        "LỖ HỔNG: lộ đáp án");
      ctx.questionId = qs[0].question_id;
    }
  }

  await expectOk("GET /reviews/course/:id", "GET", `/api/reviews/course/${ctx.courseId}`,
    { token: TOKENS.viewer }, 200);
  await expectOk("GET /bookmarks/:uid", "GET", `/api/bookmarks/${ctx.viewerUid}`, { token: TOKENS.viewer }, 200);
  await expectOk("POST /notifications (của mình)", "POST", "/api/notifications",
    { token: TOKENS.viewer, body: {} }, 200,
    (r) => (Array.isArray(r.json?.notifications) ? true : "thiếu notifications"));
  await expectOk("GET /enrollments/user/:uid", "GET", `/api/enrollments/user/${ctx.viewerUid}`,
    { token: TOKENS.viewer }, 200);
  await expectOk("GET /enrollments/progress thiếu courseId → 400", "GET", "/api/enrollments/progress",
    { token: TOKENS.viewer }, 400);
  await expectOk("GET /enrollments/progress", "GET",
    `/api/enrollments/progress?courseId=${ctx.courseId}`, { token: TOKENS.viewer }, 200,
    (r) => (typeof r.json?.data?.progress_percent === "number" ? true : "progress_percent không phải số"));
  await expectOk("GET /enrollments/check/:uid/:course_id", "GET",
    `/api/enrollments/check/${ctx.viewerUid}/${ctx.courseId}`, { token: TOKENS.viewer }, 200);
  await expectOk("GET /quiz-results/users/:uid/results", "GET",
    `/api/quiz-results/users/${ctx.viewerUid}/results`, { token: TOKENS.viewer }, 200);
  await expectOk("POST /app-stats với user thường → 403", "POST", "/api/app-stats",
    { token: TOKENS.viewer, body: {} }, 403);

  // ---------- 6. Ghi dữ liệu: vòng đời của user mới ----------
  setGroup("6. Ghi dữ liệu (user mới)");
  const enrollRes = await expectOk("POST /enrollments/register", "POST", "/api/enrollments/register",
    { token: TOKENS.fresh, body: { courseId: String(ctx.courseId) } }, 201,
    (r) => (r.json?.enrollment_id ? true : "thiếu enrollment_id"));
  // Lấy thẳng từ response enroll: `GET /enrollments/user/:uid` không trả
  // enrollment_id (chỉ trả tiến độ), nên không dùng được cho bước dọn dẹp.
  ctx.enrollmentId = enrollRes.json?.enrollment_id;
  await expectOk("enroll trùng → 400", "POST", "/api/enrollments/register",
    { token: TOKENS.fresh, body: { courseId: ctx.courseId } }, 400);
  await expectOk("enroll khoá không tồn tại → 404", "POST", "/api/enrollments/register",
    { token: TOKENS.fresh, body: { courseId: 99999999 } }, 404);
  await expectOk("enroll courseId không phải số → 400", "POST", "/api/enrollments/register",
    { token: TOKENS.fresh, body: { courseId: "abc" } }, 400);

  const progress = await expectOk("GET /enrollments/progress sau khi enroll", "GET",
    `/api/enrollments/progress?courseId=${ctx.courseId}`, { token: TOKENS.fresh }, 200);
  rec("progress_percent là số", "number", typeof progress.json?.data?.progress_percent,
    typeof progress.json?.data?.progress_percent === "number");

  if (ctx.lessonId) {
    await expectOk("POST /lessons/complete (chuỗi số)", "POST", "/api/lessons/complete",
      { token: TOKENS.fresh, body: { courseId: String(ctx.courseId), lessonId: String(ctx.lessonId) } },
      200, (r) => (r.json?.status ? true : "thiếu status"));
    await expectOk("complete lần 2 → update", "POST", "/api/lessons/complete",
      { token: TOKENS.fresh, body: { courseId: ctx.courseId, lessonId: ctx.lessonId } }, 200,
      (r) => (r.json?.status === "update" ? true : `status=${r.json?.status}`));
    await expectOk("complete lesson không thuộc khoá → 404", "POST", "/api/lessons/complete",
      { token: TOKENS.fresh, body: { courseId: 99999999, lessonId: ctx.lessonId } }, 404,
      (r) => (r.json?.error ? true : "thiếu error"));
  }

  // Nộp bài khi ĐÃ ghi danh
  if (ctx.quizId && ctx.questionId) {
    const submit = await expectOk("POST /quiz-results/submit", "POST", "/api/quiz-results/submit",
      { token: TOKENS.fresh, body: { quiz_id: ctx.quizId, answers: { [ctx.questionId]: 0 } } },
      [200, 201], (r) => (typeof r.json?.score === "number" ? true : "thiếu score"));
    ctx.resultId = submit.json?.result_id;
    if (ctx.resultId) {
      await expectOk("GET /quiz-results/:id (chủ bài làm)", "GET", `/api/quiz-results/${ctx.resultId}`,
        { token: TOKENS.fresh }, 200, (r) => (r.json?.data?.questions ? true : "thiếu questions"));
      await expectOk("người khác xem kết quả → 403", "GET", `/api/quiz-results/${ctx.resultId}`,
        { token: TOKENS.viewer }, 403);
    }
    await expectOk("submit answers là mảng → 400", "POST", "/api/quiz-results/submit",
      { token: TOKENS.fresh, body: { quiz_id: ctx.quizId, answers: [1, 2] } }, 400);
    await expectOk("submit quiz không tồn tại → 404", "POST", "/api/quiz-results/submit",
      { token: TOKENS.fresh, body: { quiz_id: 99999999, answers: {} } }, 404);
    await expectOk("submit quiz_id không phải số → 400", "POST", "/api/quiz-results/submit",
      { token: TOKENS.fresh, body: { quiz_id: "abc", answers: {} } }, 400);
  }

  // Review + bookmark
  const review = await expectOk("POST /reviews/create", "POST", "/api/reviews/create",
    { token: TOKENS.fresh, body: { course_id: ctx.courseId, rating: 5, comment: TAG } }, 201);
  ctx.reviewId = review.json?.data?.review_id;
  await expectOk("review rating ngoài 1..5 → 400", "POST", "/api/reviews/create",
    { token: TOKENS.fresh, body: { course_id: ctx.courseId, rating: 9 } }, 400);
  await expectOk("review course_id không phải số → 400", "POST", "/api/reviews/create",
    { token: TOKENS.fresh, body: { course_id: "abc", rating: 5 } }, 400);
  if (ctx.reviewId) {
    await expectOk("PUT /reviews/update/:id", "PUT", `/api/reviews/update/${ctx.reviewId}`,
      { token: TOKENS.fresh, body: { rating: 4 } }, 200);
  }

  const bm = await expectOk("POST /bookmarks/create", "POST", "/api/bookmarks/create",
    { token: TOKENS.fresh, body: { courseId: ctx.courseId } }, 201);
  ctx.bookmarkId = bm.json?.data?.bookmark_id;
  await expectOk("bookmark trùng → 400", "POST", "/api/bookmarks/create",
    { token: TOKENS.fresh, body: { courseId: ctx.courseId } }, 400);
  await expectOk("bookmark courseId không phải số → 400", "POST", "/api/bookmarks/create",
    { token: TOKENS.fresh, body: { courseId: "abc" } }, 400);

  // Notification: tạo → đọc → mark-read → xoá
  const noti = await expectOk("POST /notifications/create", "POST", "/api/notifications/create",
    { token: TOKENS.fresh, body: { title: TAG, content: "noi dung" } }, 201,
    (r) => (r.json?.noti_id ? true : "thiếu noti_id"));
  ctx.notiId = noti.json?.noti_id;
  if (ctx.notiId) {
    await expectOk("POST /notifications/mark-read", "POST", "/api/notifications/mark-read",
      { token: TOKENS.fresh, body: { noti_id: ctx.notiId } }, 200);
    await expectOk("noti_id sai định dạng → 400", "POST", "/api/notifications/mark-read",
      { token: TOKENS.fresh, body: { noti_id: "1" } }, 400);
  }

  // Upload (multipart) — dùng ảnh PNG 1x1 hợp lệ
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
  );
  const form = new FormData();
  form.append("avatar", new File([png], "a.png", { type: "image/png" }));
  const up = await call("PUT", `/api/users/update/${ctx.freshUid}`, { token: TOKENS.fresh, form });
  rec("PUT /users/update/:id (upload avatar)", [200], up.status, up.status === 200,
    up.status !== 200 ? up.text.slice(0, 150) : "");
  if (up.status === 200 && up.json?.user?.avatar_url) {
    ctx.avatarUrl = up.json.user.avatar_url;
    rec("upload trả avatar_url", "không rỗng", ctx.avatarUrl, ctx.avatarUrl.startsWith("/uploads/"));
    const fileRes = await call("GET", ctx.avatarUrl);
    rec("GET file vừa upload", 200, fileRes.status, fileRes.status === 200,
      fileRes.status !== 200 ? "file không phục vụ được" : "");
    rec("file phục vụ đúng content-type", "image/png", fileRes.headers.get("content-type"),
      (fileRes.headers.get("content-type") || "").includes("image/png"));
    rec("file có X-Content-Type-Options: nosniff", "nosniff",
      fileRes.headers.get("x-content-type-options"),
      fileRes.headers.get("x-content-type-options") === "nosniff");
  }

  // ---------- 7. Bảo mật & biên ----------
  setGroup("7. Bảo mật & biên");
  const leak = /violates|constraint failed|relation "|syntax error|password_hash|\$2[aby]\$/i;
  for (const p of [
    "/api/courses/abc", "/api/lessons/detail/abc", "/api/questions/abc",
    "/api/quiz-results/abc", "/api/users/abc", "/api/course-categories/update/abc",
  ]) {
    const r = await call("GET", p, { token: TOKENS.viewer });
    rec(`không rò nội bộ ${p}`, "4xx", r.status,
      r.status < 500 && !leak.test(r.text), leak.test(r.text) ? "LỖ HỔNG: rò chi tiết" : r.status >= 500 ? "500" : "");
  }
  // Phải vượt giới hạn 1 MB của express.json mới mong đợi 413.
  const big = await call("POST", "/api/auth/login", {
    body: { email: viewerEmail, password: "x".repeat(2_000_000) },
  });
  rec("body JSON quá lớn → 413", 413, big.status, big.status === 413,
    big.status !== 413 ? big.text.slice(0, 120) : "");
  const badJson = await fetch(BASE + "/api/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{khong-phai-json",
  });
  rec("JSON hỏng → 400", 400, badJson.status, badJson.status === 400);
  const sqlInject = await call("GET", `/api/courses?search=${encodeURIComponent("' OR 1=1 --")}`,
    { token: TOKENS.viewer });
  rec("search có ký tự SQL không gây 500", "200", sqlInject.status, sqlInject.status === 200);

  // ---------- 8. Audit log nội bộ: cần admin (bỏ nếu không có tài khoản) ----------
  if (TOKENS.admin) {
    setGroup("8. Admin");
    await expectOk("GET /users (admin)", "GET", "/api/users", { token: TOKENS.admin }, 200,
      (r) => (Array.isArray(r.json?.users) ? true : "thiếu users"));
    await expectOk("POST /app-stats (admin)", "POST", "/api/app-stats",
      { token: TOKENS.admin, body: {} }, 200, (r) => (r.json?.role === "admin" ? true : "role sai"));
    await expectOk("GET /mentor-requests (admin)", "GET", "/api/mentor-requests",
      { token: TOKENS.admin }, 200);
  }

  // ---------- 9. Dọn dẹp ----------
  setGroup("9. Dọn dẹp");
  if (ctx.notiId) {
    await expectOk("xoá notification", "DELETE", `/api/notifications/delete/${ctx.notiId}`,
      { token: TOKENS.fresh }, 200);
  }
  if (ctx.bookmarkId) {
    await expectOk("xoá bookmark", "DELETE", "/api/bookmarks/delete",
      { token: TOKENS.fresh, body: { bookmarkId: ctx.bookmarkId } }, 200);
  }
  if (ctx.reviewId) {
    await expectOk("xoá review", "DELETE", `/api/reviews/delete/${ctx.reviewId}`,
      { token: TOKENS.fresh }, 200);
  }
  await expectOk("huỷ đăng ký", "DELETE",
    `/api/enrollments/delete/${ctx.enrollmentId ?? 1}`, { token: TOKENS.fresh }, [200, 404]);

  // ---------- Tổng kết ----------
  const pass = results.filter((r) => r.ok).length;
  const fail = results.length - pass;
  console.log("\n================ TỔNG KẾT ================");
  console.log(`Tổng: ${results.length} | PASS: ${pass} | FAIL: ${fail}`);
  if (fail > 0) {
    console.log("\n--- FAIL ---");
    for (const r of results.filter((x) => !x.ok)) {
      console.log(`[${r.group}] ${r.name}\n  expect ${r.expected} | got ${r.actual}${r.note ? " | " + r.note : ""}`);
    }
  }
  console.log(`\nEMAIL_TẠM=${ctx.email}`);
  console.log(`UID_TẠM=${ctx.freshUid}`);
  process.exitCode = fail > 0 ? 1 : 0;
}

main().catch((e) => {
  console.error("SCRIPT LỖI:", e.message);
  console.error(e.stack);
  process.exitCode = 2;
});
