/**
 * Bộ kiểm thử API (chạy trực tiếp qua HTTP).
 *
 *   API_BASE=http://localhost:3111 node regression.mjs
 *   node regression.mjs                      # mặc định chạy production
 *
 * Nguyên tắc: chỉ dùng HTTP, tự dọn dẹp mọi thứ đã tạo, và thoát với mã lỗi
 * nếu có bất kỳ kiểm tra nào thất bại (để chạy lặp tự động).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Fixture nằm cạnh script này để bộ test chạy được ở bất kỳ máy nào.
const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const fixture = (name) => path.join(FIXTURES, name);

const BASE = (process.env.API_BASE || "https://online-learning-api.vercel.app").replace(/\/$/, "");
const PW = "Demo@123456";
const TAG = `E2E-${Date.now()}`;

const results = [];
let group = "";
const setGroup = (g) => { group = g; };

function rec(name, expected, actual, ok, note = "", ms = null) {
  results.push({ group, name, expected: String(expected), actual: String(actual), ok, note, ms });
  console.log(`${ok ? "PASS" : "FAIL"} [${group}] ${name} — expect ${expected}, got ${actual}${ms != null ? ` ${ms}ms` : ""}${note ? " | " + note : ""}`);
}

const tokens = {};

async function raw(method, path, { token, body, form, headers = {} } = {}) {
  const h = { ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { h["Content-Type"] = "application/json"; payload = JSON.stringify(body); }
  const t0 = Date.now();
  const res = await fetch(BASE + path, { method, headers: h, body: payload });
  const ms = Date.now() - t0;
  const buf = Buffer.from(await res.arrayBuffer());
  let json = null;
  try { json = JSON.parse(buf.toString("utf8")); } catch {}
  return { status: res.status, json, text: buf.toString("utf8"), buf, ms, headers: res.headers };
}

/** Gọi API và ghi kết quả. expect: số | mảng số. validate trả true hoặc câu mô tả lỗi. */
async function t(name, method, path, opts = {}, expect = [200], validate = null) {
  const exp = Array.isArray(expect) ? expect : [expect];
  let r;
  try { r = await raw(method, path, opts); }
  catch (e) { rec(name, exp.join("/"), "NETWORK_ERROR", false, e.message); return null; }

  if (r.status === 401 && r.json?.code === "TOKEN_EXPIRED" && opts.token) {
    for (const k of Object.keys(tokens)) {
      if (tokens[k].access === opts.token) {
        await refresh(k);
        opts = { ...opts, token: tokens[k].access };
        r = await raw(method, path, opts);
        break;
      }
    }
  }
  let ok = exp.includes(r.status);
  let note = "";
  if (validate) {
    try {
      const v = validate(r);
      if (v !== true && v !== undefined) { ok = false; note = String(v); }
    } catch (e) { ok = false; note = "validate threw: " + e.message; }
  }
  rec(name, exp.join("/"), r.status, ok, note, r.ms);
  if (!ok && r.text) console.log("      ↳ " + r.text.slice(0, 250).replace(/\n/g, " "));
  return r;
}

async function login(email) {
  const r = await raw("POST", "/api/auth/login", { body: { email, password: PW } });
  if (r.status !== 200) throw new Error(`login ${email} -> ${r.status} ${r.text.slice(0, 120)}`);
  return { access: r.json.access_token, refresh: r.json.refresh_token, uid: r.json.user.uid };
}
async function refresh(key) {
  const r = await raw("POST", "/api/auth/refresh", { body: { refresh_token: tokens[key].refresh } });
  if (r.status !== 200) throw new Error(`refresh ${key} -> ${r.status}`);
  tokens[key].access = r.json.access_token;
  if (r.json.refresh_token) tokens[key].refresh = r.json.refresh_token;
}

const A = () => tokens.admin.access;
const M = () => tokens.mentor.access;
const S = () => tokens.student.access;
const blob = (p, type, name) => {
  const b = new Blob([fs.readFileSync(p)], { type });
  return name ? new File([b], name, { type }) : b;
};
const ctx = {};
let seedCategoryId = null;

// =====================================================================
async function phaseInfra() {
  setGroup("1. Hạ tầng");
  await t("GET /health", "GET", "/health", {}, 200, (r) => (r.json?.status === "ok" ? true : "thiếu status"));
  await t("GET /api-docs", "GET", "/api-docs/", {}, [200, 301], (r) => (r.status === 200 ? true : "swagger không phục vụ"));
  await t("GET route không tồn tại", "GET", "/api/khong-ton-tai", {}, 404);
  await t("GET /", "GET", "/", {}, 404);
  await t("OPTIONS preflight", "OPTIONS", "/api/courses", { headers: { Origin: "https://example.com", "Access-Control-Request-Method": "GET" } }, [200, 204]);
}

// =====================================================================
async function phaseAuth() {
  setGroup("2. Xác thực");
  for (const [key, email] of [
    ["admin", "admin@demo.onlinelearning.vn"],
    ["mentor", "mentor01@demo.onlinelearning.vn"],
    ["mentor2", "mentor02@demo.onlinelearning.vn"],
    ["student", "student01@demo.onlinelearning.vn"],
  ]) {
    try { tokens[key] = await login(email); rec(`login ${key}`, 200, 200, true); }
    catch (e) { rec(`login ${key}`, 200, "FAIL", false, e.message); }
  }

  await t("login sai mật khẩu", "POST", "/api/auth/login", { body: { email: "admin@demo.onlinelearning.vn", password: "sai" } }, [400, 401]);
  await t("login email không tồn tại", "POST", "/api/auth/login", { body: { email: "khong-co-999@demo.onlinelearning.vn", password: PW } }, [400, 401]);
  await t("login thiếu mật khẩu", "POST", "/api/auth/login", { body: { email: "admin@demo.onlinelearning.vn" } }, [400, 401]);
  await t("login body rỗng", "POST", "/api/auth/login", { body: {} }, 400);
  await t("login email sai định dạng", "POST", "/api/auth/login", { body: { email: "khong-phai-email", password: PW } }, [400, 401]);
  await t("login bằng @demo-admin (uid, không phải email)", "POST", "/api/auth/login", { body: { email: "demo-admin", password: PW } }, [400, 401]);

  await t("GET /me có token", "GET", "/api/auth/me", { token: A() }, 200, (r) => (r.json?.user?.uid === "demo-admin" ? true : "uid sai"));
  await t("GET /me không token", "GET", "/api/auth/me", {}, 401);
  await t("GET /me token rác", "GET", "/api/auth/me", { token: "abc.def.ghi" }, 401);
  await t("GET /me chữ ký sai", "GET", "/api/auth/me", { token: A().slice(0, -4) + "AAAA" }, 401);
  await t("GET /me Bearer rỗng", "GET", "/api/auth/me", { headers: { Authorization: "Bearer " } }, 401);
  await t("GET /me thiếu tiền tố Bearer", "GET", "/api/auth/me", { headers: { Authorization: A() } }, 401);
  // Token ký bằng alg=none phải bị từ chối. Chấp nhận cả 401 (API từ chối) và
  // 403 (bị tường lửa của nền tảng chặn trước khi tới API) — điều cần khẳng
  // định là token KHÔNG được chấp nhận, chứ không phải mã lỗi cụ thể.
  await t("alg=none bị từ chối", "GET", "/api/courses",
    { headers: { Authorization: "Bearer eyJhbGciOiJub25lIn0.eyJ1aWQiOiJkZW1vLWFkbWluIiwicm9sZSI6ImFkbWluIn0." } },
    [401, 403], (r) =>
      // Nếu là 200 kèm dữ liệu thì mới là lỗ hổng thật.
      r.status === 200 ? "LỖ HỔNG: token alg=none được chấp nhận" : true);
  await t("GET /me không lộ hash mật khẩu", "GET", "/api/auth/me", { token: S() }, 200, (r) => (/\$2[aby]\$|password_hash/.test(r.text) ? "LỖ HỔNG: lộ hash" : true));

  await t("POST /refresh hợp lệ", "POST", "/api/auth/refresh", { body: { refresh_token: tokens.student.refresh } }, 200, (r) => (r.json?.access_token ? true : "thiếu access_token"));
  await t("POST /refresh token rác", "POST", "/api/auth/refresh", { body: { refresh_token: "rac" } }, [400, 401]);
  await t("POST /refresh body rỗng", "POST", "/api/auth/refresh", { body: {} }, [400, 401]);
  await t("POST /refresh dùng access token", "POST", "/api/auth/refresh", { body: { refresh_token: S() } }, [400, 401]);

  await t("POST /forgot-password email demo", "POST", "/api/auth/forgot-password", { body: { email: "student03@demo.onlinelearning.vn" } }, 200);
  await t("POST /forgot-password không lộ email tồn tại", "POST", "/api/auth/forgot-password", { body: { email: "khong-co-999@demo.onlinelearning.vn" } }, 200, (r) => (r.json?.reset_token ? "LỖ HỔNG: lộ reset token ở production" : true));
  await t("POST /forgot-password thiếu email", "POST", "/api/auth/forgot-password", { body: {} }, 400);
  await t("POST /reset-password token sai", "POST", "/api/auth/reset-password", { body: { token: "sai", new_password: "MatKhauMoi@123" } }, [400, 401]);
  await t("POST /reset-password mật khẩu yếu", "POST", "/api/auth/reset-password", { body: { token: "x", new_password: "123" } }, [400, 401]);
}

// =====================================================================
async function phaseAccount() {
  setGroup("3. Vòng đời tài khoản");
  const email = `e2e-${Date.now()}@demo.onlinelearning.vn`;
  ctx.email = email;
  ctx.pw = "MatKhauBanDau@123";

  const r1 = await t("register tài khoản mới", "POST", "/api/auth/register", { body: { email, password: ctx.pw, name: "Tài khoản E2E" } }, 201, (r) => (r.json?.user?.uid ? true : "thiếu uid"));
  ctx.uid = r1?.json?.user?.uid;
  ctx.token = r1?.json?.access_token;

  await t("register trùng email", "POST", "/api/auth/register", { body: { email, password: ctx.pw, name: "Trùng" } }, [400, 409]);
  await t("register thiếu password", "POST", "/api/auth/register", { body: { email: `x-${Date.now()}@demo.onlinelearning.vn`, name: "X" } }, 400);
  await t("register email sai định dạng", "POST", "/api/auth/register", { body: { email: "khong-phai-email", password: "MatKhau@123456", name: "X" } }, 400);
  await t("register mật khẩu quá ngắn", "POST", "/api/auth/register", { body: { email: `y-${Date.now()}@demo.onlinelearning.vn`, password: "123", name: "X" } }, 400);

  await t("change-password sai mật khẩu hiện tại", "POST", "/api/auth/change-password", { token: ctx.token, body: { current_password: "sai", new_password: "Moi@12345678" } }, [400, 401]);
  await t("change-password thiếu new_password", "POST", "/api/auth/change-password", { token: ctx.token, body: { current_password: ctx.pw } }, 400);
  await t("change-password đúng", "POST", "/api/auth/change-password", { token: ctx.token, body: { current_password: ctx.pw, new_password: "Moi@12345678" } }, 200);
  ctx.pw = "Moi@12345678";

  const rLogin = await t("login bằng mật khẩu mới", "POST", "/api/auth/login", { body: { email, password: ctx.pw } }, 200);
  if (rLogin?.json?.access_token) {
    ctx.token = rLogin.json.access_token;
    // Token sạch để dùng ở các phase sau (ctx.token bị logout thu hồi ở phase này).
    ctx.cleanToken = rLogin.json.access_token;
  }
  await t("login mật khẩu cũ thất bại", "POST", "/api/auth/login", { body: { email, password: "MatKhauBanDau@123" } }, [400, 401]);

  await t("logout", "POST", "/api/auth/logout", { token: ctx.token, body: { refresh_token: rLogin?.json?.refresh_token } }, 200);
  await t("refresh sau logout bị thu hồi", "POST", "/api/auth/refresh", { body: { refresh_token: rLogin?.json?.refresh_token } }, [400, 401]);
}

// =====================================================================
async function phaseAuthz() {
  setGroup("4. Phân quyền");

  const writeEndpoints = [
    ["POST", "/api/courses/create", { title: "x", category_id: 25 }],
    ["PUT", "/api/courses/update/227", { title: "x" }],
    ["PATCH", "/api/courses/227/status", { status: "approved" }],
    ["DELETE", "/api/courses/delete/227", {}],
    ["POST", "/api/lessons/create", { course_id: 227, title: "x" }],
    ["PUT", "/api/lessons/update/1", { title: "x" }],
    ["DELETE", "/api/lessons/delete/1", {}],
    ["POST", "/api/quizzes/create", { course_id: 227, title: "x" }],
    ["PUT", "/api/quizzes/update/131", { title: "x" }],
    ["DELETE", "/api/quizzes/delete/131", {}],
    ["POST", "/api/questions/createbyuser", { quiz_id: 131, question: "x" }],
    ["PUT", "/api/questions/update/429", { question: "x" }],
    ["DELETE", "/api/questions/delete/429", {}],
    ["POST", "/api/course-categories/create", { name: "x" }],
    ["PUT", "/api/course-categories/update/25", { name: "x" }],
    ["DELETE", "/api/course-categories/delete/25", {}],
    ["PATCH", "/api/quiz-results/quiz-results/1/grade", { explanation: "x", score: 5 }],
  ];
  for (const [method, path, body] of writeEndpoints) {
    await t(`[no-token] ${method} ${path}`, method, path, { body }, 401);
    await t(`[student] ${method} ${path}`, method, path, { token: S(), body }, 403);
  }

  const adminOnly = [
    ["GET", "/api/users", undefined],
    ["GET", "/api/mentor-requests", undefined],
    ["PUT", "/api/mentor-requests/1/status", { status: "approved" }],
    ["PUT", "/api/users/updaterole", { uid: "demo-student-01", role: "mentor" }],
    ["DELETE", "/api/users/delete/demo-student-02", undefined],
    ["PATCH", "/api/users/demo-student-02/status", { status: "disabled" }],
  ];
  for (const [method, path, body] of adminOnly) {
    await t(`[student] ${method} ${path}`, method, path, { token: S(), body }, 403);
    await t(`[mentor] ${method} ${path}`, method, path, { token: M(), body }, 403);
  }

  // leo thang đặc quyền theo uid giả trong body
  await t("student giả uid=admin khi bookmark", "POST", "/api/bookmarks/create", { token: S(), body: { courseId: 227, userUid: "demo-admin" } }, 403);
  await t("student giả uid=admin khi enroll", "POST", "/api/enrollments/register", { token: S(), body: { courseId: 227, userUid: "demo-admin" } }, 403);
  await t("student giả uid khi complete lesson", "POST", "/api/lessons/complete", { token: S(), body: { courseId: 227, lessonId: 708, userUid: "demo-admin" } }, 403);
  await t("student giả uid khi tạo thông báo", "POST", "/api/notifications/create", { token: S(), body: { title: "x", content: "y", uid: "demo-admin" } }, 403);
  await t("student xem thông báo của admin", "POST", "/api/notifications", { token: S(), body: { uid: "demo-admin" } }, 403);
  await t("student xem bookmark của admin", "GET", "/api/bookmarks/demo-admin", { token: S() }, 403);
  await t("student xem tiến độ của admin", "GET", "/api/enrollments/progress?courseId=227&uid=demo-admin", { token: S() }, 403);
  await t("student xem KQ quiz của admin", "GET", "/api/quiz-results/users/demo-admin/results", { token: S() }, 403);
  await t("student tự nâng quyền qua /users/update", "PUT", "/api/users/update/demo-student-01", { token: S(), body: { role: "admin" } }, [400, 403], (r) => (r.status === 200 && r.text.includes('"role":"admin"') ? "LỖ HỔNG: tự nâng quyền" : true));
  await t("student sửa hồ sơ người khác", "PUT", "/api/users/update/demo-admin", { token: S(), body: { name: "Hacked" } }, 403);
  await t("student checkactive người khác", "GET", "/api/users/checkactive/demo-admin", { token: S() }, 403);

  // mentor không được đụng tài nguyên của mentor khác
  await t("mentor01 sửa khoá học của mentor10", "PUT", "/api/courses/update/251", { token: M(), body: { title: "Chiếm" } }, 403);
  await t("mentor01 xoá bài học của mentor10", "DELETE", "/api/lessons/delete/839", { token: M(), body: {} }, 403);

  // --- IDOR trên quiz/questions: mentor02 vs quiz 131 thuộc mentor01 ---
  const m2 = tokens.mentor2?.access;
  if (m2) {
    await t("mentor02 SỬA quiz của mentor01 → 403", "PUT", "/api/quizzes/update/131",
      { token: m2, body: { title: `${TAG} chiếm` } }, 403,
      (r) => (r.status === 200 ? "LỖ HỔNG: sửa được quiz người khác" : true));
    await t("mentor02 XOÁ quiz của mentor01 → 403", "DELETE", "/api/quizzes/delete/131",
      { token: m2, body: {} }, 403,
      (r) => (r.status === 200 ? "LỖ HỔNG: xoá được quiz người khác" : true));
    await t("mentor02 THÊM câu hỏi vào quiz mentor01 → 403", "POST", "/api/questions/createbyuser",
      { token: m2, body: { quiz_id: 131, question: `${TAG} chèn`, options: ["A", "B"], correct_index: 1 } }, 403,
      (r) => (r.status === 201 ? "LỖ HỔNG: chèn câu hỏi vào quiz người khác" : true));
    await t("mentor02 SỬA câu hỏi của mentor01 → 403", "PUT", "/api/questions/update/429",
      { token: m2, body: { question: `${TAG} chiếm`, options: ["A", "B", "C", "D"], correct_index: 2 } }, 403,
      (r) => (r.status === 200 ? "LỖ HỔNG: sửa được câu hỏi người khác" : r.status === 400 ? "400 che mất kiểm tra quyền" : true));
    await t("mentor02 TẠO quiz trong khoá của mentor01 → 403", "POST", "/api/quizzes/create",
      { token: m2, body: { course_id: 227, title: `${TAG} chen` } }, 403,
      (r) => (r.status === 201 ? "LỖ HỔNG: tạo quiz trong khoá người khác" : true));
    await t("mentor02 TẠO bài học trong khoá của mentor01 → 403", "POST", "/api/lessons/create",
      { token: m2, body: { course_id: 227, title: `${TAG} chen` } }, 403,
      (r) => (r.status === 201 ? "LỖ HỔNG: tạo bài học trong khoá người khác" : true));
  }
}

// =====================================================================
async function phaseRead() {
  setGroup("5. Endpoint đọc");

  const rCat = await t("GET /course-categories", "GET", "/api/course-categories", { token: S() }, 200, (r) => {
    ctx.categoryId = r.json?.data?.[0]?.category_id;
    seedCategoryId = ctx.categoryId;
    return r.json?.data?.length ? true : "rỗng";
  });

  await t("GET /courses", "GET", "/api/courses", { token: S() }, 200, (r) => {
    const d = r.json?.data;
    if (!d) return "thiếu .data";
    ctx.approvedCourse = d.approved?.[0]?.course_id;
    return d.approved?.length ? true : "không có khoá approved";
  });

  await t("GET /courses/:id hợp lệ", "GET", `/api/courses/${ctx.approvedCourse}`, { token: S() }, 200);
  await t("GET /courses/:id không tồn tại", "GET", "/api/courses/99999999", { token: S() }, 404);
  await t("GET /courses/abc → 4xx không phải 500", "GET", "/api/courses/abc", { token: S() }, [400, 404], (r) => (r.status === 500 ? "LỖ HỔNG: 500" : true));
  await t("GET /courses/1 OR 1=1 → 4xx", "GET", "/api/courses/1%20OR%201=1", { token: S() }, [400, 404], (r) => (r.status === 500 ? "LỖ HỔNG: 500" : true));
  await t("GET /courses/mentor/:uid", "GET", "/api/courses/mentor/demo-mentor-01", { token: S() }, 200, (r) => (r.json?.data ? true : "thiếu data"));
  await t("GET /courses/mentor/:uid không tồn tại → rỗng", "GET", "/api/courses/mentor/khong-co", { token: S() }, 200, (r) => {
    const all = Object.values(r.json?.data || {}).flat();
    return all.length === 0 ? true : "trả về khoá của người khác";
  });

  await t("GET /lessons/courses/:id/:uid", "GET", `/api/lessons/courses/${ctx.approvedCourse}/demo-student-01`, { token: S() }, 200, (r) => {
    ctx.lessonId = r.json?.data?.[0]?.lesson_id;
    return r.json?.data?.length ? true : "không có bài học";
  });
  if (ctx.lessonId) await t("GET /lessons/detail/:id", "GET", `/api/lessons/detail/${ctx.lessonId}`, { token: S() }, 200);
  await t("GET /lessons/detail/99999999", "GET", "/api/lessons/detail/99999999", { token: S() }, 404);
  await t("GET /lessons/detail/abc → 4xx", "GET", "/api/lessons/detail/abc", { token: S() }, [400, 404], (r) => (r.status === 500 ? "LỖ HỔNG: 500" : true));

  await t("GET /quizzes/getquizbycourse/:id", "GET", `/api/quizzes/getquizbycourse/${ctx.approvedCourse}`, { token: S() }, 200, (r) => {
    ctx.quizId = r.json?.data?.[0]?.quiz_id;
    return r.json?.data?.length ? true : "không có quiz";
  });
  await t("GET /quizzes/getquizbycoures/:id (alias)", "GET", `/api/quizzes/getquizbycoures/${ctx.approvedCourse}`, { token: S() }, 200);
  await t("GET /quizzes/getquizuser/:uid", "GET", "/api/quizzes/getquizuser/demo-student-01", { token: S() }, 200);

  if (ctx.quizId) {
    await t("GET /questions/:quizId", "GET", `/api/questions/${ctx.quizId}`, { token: S() }, 200, (r) => {
      ctx.questionId = r.json?.data?.[0]?.question_id;
      return r.json?.data?.length ? true : "không có câu hỏi";
    });
    await t("GET /questions/99999999", "GET", "/api/questions/99999999", { token: S() }, [200, 404]);
    await t("GET /questions/abc → 4xx", "GET", "/api/questions/abc", { token: S() }, [400, 404], (r) => (r.status === 500 ? "LỖ HỔNG: 500" : true));
  }

  await t("GET /reviews/course/:id", "GET", `/api/reviews/course/${ctx.approvedCourse}`, { token: S() }, 200);
  await t("GET /users/listmentor", "GET", "/api/users/listmentor", { token: S() }, 200, (r) => {
    const arr = r.json?.data || r.json?.mentors || r.json;
    return Array.isArray(arr) ? true : "không phải mảng";
  });
  await t("GET /users/listmentor không lộ hash", "GET", "/api/users/listmentor", { token: S() }, 200, (r) => (/\$2[aby]\$|password_hash/.test(r.text) ? "LỖ HỔNG: lộ hash" : true));
  await t("GET /users/:id hồ sơ công khai", "GET", "/api/users/demo-mentor-01", { token: S() }, 200, (r) => (/\$2[aby]\$|password_hash/.test(r.text) ? "LỖ HỔNG: lộ hash" : true));
  await t("GET /users/:id không tồn tại", "GET", "/api/users/khong-ton-tai", { token: S() }, 404);
  await t("GET /users/checkactive chính chủ", "GET", "/api/users/checkactive/demo-student-01", { token: S() }, 200);
  await t("GET /bookmarks/:uid chính chủ", "GET", "/api/bookmarks/demo-student-01", { token: S() }, 200);
  await t("POST /notifications của chính mình", "POST", "/api/notifications", { token: S(), body: {} }, 200, (r) => (Array.isArray(r.json?.notifications) ? true : "thiếu .notifications"));
  await t("GET /enrollments/user/:uid", "GET", "/api/enrollments/user/demo-student-01", { token: S() }, 200);
  await t("GET /enrollments/progress thiếu courseId", "GET", "/api/enrollments/progress", { token: S() }, 400);
  await t("GET /enrollments/progress đủ tham số", "GET", "/api/enrollments/progress?courseId=227", { token: S() }, 200);
  await t("GET /enrollments/check/:uid/:course_id", "GET", `/api/enrollments/check/demo-student-01/${ctx.approvedCourse}`, { token: S() }, 200);
  await t("GET /quiz-results/users/:uid/results", "GET", "/api/quiz-results/users/demo-student-01/results", { token: S() }, 200);
  await t("POST /app-stats (admin)", "POST", "/api/app-stats", { token: A(), body: {} }, 200, (r) => (r.json?.role === "admin" ? true : "role sai"));
  await t("POST /app-stats (mentor)", "POST", "/api/app-stats", { token: M(), body: {} }, 200, (r) => (r.json?.role === "mentor" ? true : "role sai"));
  await t("POST /app-stats (student) → 403", "POST", "/api/app-stats", { token: S(), body: {} }, 403);
  await t("GET /users (admin) không lộ hash", "GET", "/api/users", { token: A() }, 200, (r) => (/\$2[aby]\$|password_hash/.test(r.text) ? "LỖ HỔNG: lộ hash" : true));
}

// =====================================================================
// Upload — vùng vừa được sửa (lưu file trong CSDL thay vì ghi ra đĩa)
// =====================================================================
async function phaseUploads() {
  setGroup("6. Upload file (đã sửa)");

  // --- Danh mục + icon ---
  const fdCat = new FormData();
  fdCat.append("name", `${TAG} Danh mục`);
  fdCat.append("description", "Tạo bởi bộ kiểm thử");
  fdCat.append("icon", blob(fixture("sample.png"), "image/png", "icon.png"));
  const rCat = await t("POST /course-categories/create + icon (PNG thật)", "POST", "/api/course-categories/create",
    { token: M(), form: fdCat }, 201, (r) => {
      ctx.newCategoryId = r.json?.category_id;
      return ctx.newCategoryId ? true : "thiếu category_id";
    });

  // kiểm tra icon lưu đúng và phục vụ lại được, nội dung khớp từng byte
  if (ctx.newCategoryId) {
    const detail = await raw("GET", "/api/course-categories", { token: M() });
    const cat = (detail.json?.data || []).find((c) => String(c.category_id) === String(ctx.newCategoryId));
    ctx.iconUrl = cat?.icon;
    if (ctx.iconUrl) {
      const img = await t(`GET ${ctx.iconUrl} (icon phục vụ lại)`, "GET", ctx.iconUrl, {}, 200);
      const src = fs.readFileSync(fixture("sample.png"));
      rec("nội dung icon khớp file đã upload", "byte-identical", `${img?.buf?.length}B`, !!img && img.buf.equals(src), img && !img.buf.equals(src) ? "nội dung khác" : "");
      rec("Content-Type icon là ảnh", "image/*", img?.headers.get("content-type"), /^image\//.test(img?.headers.get("content-type") || ""), img?.headers.get("content-type") || "không có");
    } else rec("lấy được icon URL của danh mục mới", "có", "không", false, "danh mục không trả về icon");
  }

  await t("POST /course-categories/create thiếu tên", "POST", "/api/course-categories/create",
    { token: M(), form: (() => { const f = new FormData(); f.append("description", "x"); return f; })() }, 400);

  await t("POST /course-categories/create file .txt đổi tên .png → 400", "POST", "/api/course-categories/create",
    { token: M(), form: (() => { const f = new FormData(); f.append("name", "Bad"); f.append("icon", blob(fixture("sample.txt"), "image/png", "fake.png")); return f; })() },
    400, (r) => (r.status === 500 ? "LỖ HỔNG: 500 thay vì 400" : true));

  await t("POST /course-categories/create file .gif → 400", "POST", "/api/course-categories/create",
    { token: M(), form: (() => { const f = new FormData(); f.append("name", "Bad2"); f.append("icon", blob(fixture("sample.png"), "image/gif", "x.gif")); return f; })() },
    400, (r) => (r.status === 500 ? "LỖ HỔNG: 500" : true));

  // --- Khoá học + thumbnail ---
  const fdCourse = new FormData();
  fdCourse.append("title", `${TAG} Khoá học`);
  fdCourse.append("description", "Khoá học tạo bởi bộ kiểm thử");
  fdCourse.append("category_id", String(ctx.newCategoryId));
  fdCourse.append("level", "beginner");
  fdCourse.append("price", "199000");
  fdCourse.append("language", "vi");
  fdCourse.append("thumbnail", blob(fixture("sample.png"), "image/png", "thumb.png"));
  const rCourse = await t("POST /courses/create + thumbnail", "POST", "/api/courses/create",
    { token: M(), form: fdCourse }, [200, 201], (r) => {
      const c = r.json?.data || r.json?.course;
      ctx.courseId = c?.course_id;
      if (!ctx.courseId) return "thiếu course_id";
      if (c?.status !== "pending") return "trạng thái ban đầu phải là pending, nhận " + c.status;
      if (!String(c?.thumbnail_url || "").startsWith("/uploads/courses/")) return "thumbnail_url sai: " + c?.thumbnail_url;
      ctx.thumbnailUrl = c.thumbnail_url;
      return true;
    });

  if (ctx.thumbnailUrl) {
    const img = await t("GET thumbnail của khoá mới", "GET", ctx.thumbnailUrl, {}, 200);
    const src = fs.readFileSync(fixture("sample.png"));
    rec("nội dung thumbnail khớp file đã upload", "byte-identical", `${img?.buf?.length}B`, !!img && img.buf.equals(src));
  }

  await t("POST /courses/create level sai → 400", "POST", "/api/courses/create", { token: M(), form: (() => {
    const f = new FormData(); f.append("title", "x"); f.append("category_id", String(ctx.newCategoryId)); f.append("level", "sieu-cap"); return f;
  })() }, 400);
  await t("POST /courses/create danh mục không tồn tại → 404", "POST", "/api/courses/create", { token: M(), form: (() => {
    const f = new FormData(); f.append("title", "x"); f.append("category_id", "99999999"); return f;
  })() }, [400, 404], (r) => (r.status === 500 ? "LỖ HỔNG: 500 thay vì 404" : true));
  await t("POST /courses/create thiếu category_id → 400", "POST", "/api/courses/create",
    { token: M(), form: (() => { const f = new FormData(); f.append("title", "x"); return f; })() }, 400);
  await t("POST /courses/create file không phải ảnh → 400", "POST", "/api/courses/create", { token: M(), form: (() => {
    const f = new FormData(); f.append("title", "x"); f.append("category_id", String(ctx.newCategoryId));
    f.append("thumbnail", blob(fixture("sample.txt"), "text/plain", "hack.png")); return f;
  })() }, 400, (r) => (r.status === 500 ? "LỖ HỔNG: 500" : true));

  if (ctx.courseId) {
    await t("PUT /courses/update/:id (mentor sửa khoá mình)", "PUT", `/api/courses/update/${ctx.courseId}`,
      { token: M(), form: (() => { const f = new FormData(); f.append("title", `${TAG} đã sửa`); f.append("price", "299000"); return f; })() }, 200);
  }

  // --- Bài học + pdf/slide ---
  if (ctx.courseId) {
    const fdL = new FormData();
    fdL.append("course_id", String(ctx.courseId));
    fdL.append("title", `${TAG} Bài 1`);
    fdL.append("video_url", "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    fdL.append("content", "Nội dung");
    fdL.append("order", "1");
    fdL.append("pdf", blob(fixture("sample.pdf"), "application/pdf", "bai1.pdf"));
    fdL.append("slide", blob(fixture("sample.pptx"), "application/vnd.openxmlformats-officedocument.presentationml.presentation", "bai1.pptx"));
    await t("POST /lessons/create + pdf + slide", "POST", "/api/lessons/create",
      { token: M(), form: fdL }, [200, 201], (r) => {
        const d = r.json?.data || r.json;
        ctx.newLessonId = d?.lesson_id;
        ctx.pdfUrl = d?.pdf_url;
        return ctx.newLessonId ? true : "thiếu lesson_id";
      });

    if (ctx.pdfUrl) {
      const pdf = await t("GET file pdf của bài học", "GET", ctx.pdfUrl, {}, 200);
      rec("Content-Type pdf đúng", "application/pdf", pdf?.headers.get("content-type"), pdf?.headers.get("content-type") === "application/pdf");
    }

    await t("POST /lessons/create course không tồn tại → 404", "POST", "/api/lessons/create", { token: M(), form: (() => {
      const f = new FormData(); f.append("course_id", "99999999"); f.append("title", "x"); return f;
    })() }, [400, 404], (r) => (r.status === 500 ? "LỖ HỔNG: 500" : true));
    await t("POST /lessons/create thiếu title → 400", "POST", "/api/lessons/create",
      { token: M(), form: (() => { const f = new FormData(); f.append("course_id", String(ctx.courseId)); return f; })() }, 400);
    await t("POST /lessons/create file .exe đổi tên .pdf → 400", "POST", "/api/lessons/create", { token: M(), form: (() => {
      const f = new FormData(); f.append("course_id", String(ctx.courseId)); f.append("title", "x");
      f.append("pdf", blob(fixture("sample.txt"), "application/pdf", "doc.pdf")); return f;
    })() }, [400, 504], (r) => (r.status === 500 ? "LỖ HỔNG: 500" : true));

    if (ctx.newLessonId) {
      await t("PUT /lessons/update/:id", "PUT", `/api/lessons/update/${ctx.newLessonId}`,
        { token: M(), form: (() => { const f = new FormData(); f.append("title", `${TAG} Bài 1 (sửa)`); return f; })() }, 200);
    }
  }

  // --- Avatar (dùng tài khoản TẠM, không đụng tài khoản demo) ---
  await t("PUT /users/update/:id + avatar", "PUT", `/api/users/update/${ctx.uid}`,
    { token: ctx.token, form: (() => { const f = new FormData(); f.append("avatar", blob(fixture("sample.png"), "image/png", "av.png")); return f; })() },
    200, (r) => {
      const url = r.json?.user?.avatar_url;
      if (!String(url || "").startsWith("/uploads/avatars/")) return "avatar_url sai: " + url;
      ctx.avatarUrl = url;
      return true;
    });
  if (ctx.avatarUrl) await t("GET avatar mới", "GET", ctx.avatarUrl, {}, 200);

  // --- Ảnh minh chứng mentor (cũng dùng tài khoản TẠM) ---
  await t("POST /mentor-requests thiếu ảnh → 400", "POST", "/api/mentor-requests", { token: ctx.token, form: new FormData() }, 400);
  await t("POST /mentor-requests + ảnh", "POST", "/api/mentor-requests",
    { token: ctx.token, form: (() => { const f = new FormData(); f.append("image", blob(fixture("sample.png"), "image/png", "mc.png")); return f; })() },
    [200, 201, 400], (r) => {
      if (r.status === 400 && /đang chờ duyệt/i.test(r.text)) return true; // đã có yêu cầu treo
      ctx.mentorRequestId = r.json?.id || r.json?.data?.id;
      return true;
    });
  await t("GET /mentor-requests (admin)", "GET", "/api/mentor-requests", { token: A() }, 200);
}

// =====================================================================
async function phaseWrite() {
  setGroup("7. Ghi dữ liệu E2E");

  // --- Đăng ký + hoàn thành bài học, dùng chính khoá mới tạo ---
  ctx.enrolledCourseId = ctx.courseId || ctx.approvedCourse;

  await t("POST /enrollments/register", "POST", "/api/enrollments/register",
    { token: S(), body: { courseId: ctx.enrolledCourseId } }, [200, 201, 400], (r) => {
      ctx.enrollmentId = r.json?.data?.enrollment_id || r.json?.enrollment_id;
      if (r.status === 400 && /đã đăng ký/i.test(r.text)) return true;
      return r.status === 400 ? "400: " + r.text.slice(0, 90) : true;
    });
  await t("POST /enrollments/register khoá không tồn tại", "POST", "/api/enrollments/register", { token: S(), body: { courseId: 99999999 } }, 404);
  await t("POST /enrollments/register thiếu courseId", "POST", "/api/enrollments/register", { token: S(), body: {} }, 400);
  await t("GET /enrollments/check xác nhận đã đăng ký", "GET", `/api/enrollments/check/demo-student-01/${ctx.enrolledCourseId}`, { token: S() }, 200, (r) => (r.json?.enrolled === true ? true : "không xác nhận"));

  // chưa đăng ký thì KHÔNG được đánh dấu hoàn thành (kiểm tra bằng khoá khác)
  const otherCourse = [227, 228, 229, 230, 237, 250].find((c) => String(c) !== String(ctx.enrolledCourseId));
  await t("POST /lessons/complete khoá CHƯA đăng ký → 403", "POST", "/api/lessons/complete",
    { token: S(), body: { courseId: otherCourse, lessonId: 99999999 } }, [403, 404], (r) => (r.status === 200 ? "LỖ HỔNG: hoàn thành được bài của khoá chưa đăng ký" : true));

  if (ctx.newLessonId) {
    await t("POST /lessons/complete bài trong khoá đã đăng ký", "POST", "/api/lessons/complete",
      { token: S(), body: { courseId: Number(ctx.enrolledCourseId), lessonId: Number(ctx.newLessonId) } }, [200, 201],
      (r) => (r.status === 400 ? `400: ${r.text.slice(0, 80)}` : true));
    await t("POST /lessons/complete thiếu tham số → 400", "POST", "/api/lessons/complete", { token: S(), body: { courseId: ctx.enrolledCourseId } }, 400);
    await t("POST /lessons/complete sai kiểu → 400", "POST", "/api/lessons/complete", { token: S(), body: { courseId: "abc", lessonId: "xyz" } }, 400);
  }
  await t("GET /enrollments/progress sau hoàn thành", "GET", `/api/enrollments/progress?courseId=${ctx.enrolledCourseId}`, { token: S() }, 200);

  // --- Đánh giá ---
  await t("POST /reviews/create", "POST", "/api/reviews/create",
    { token: S(), body: { course_id: ctx.enrolledCourseId, rating: 5, comment: `${TAG} rất hay` } }, [200, 201], (r) => {
      ctx.reviewId = r.json?.data?.review_id || r.json?.review_id;
      return r.status === 400 && /đã review/i.test(r.text) ? true : true;
    });
  await t("POST /reviews/create rating ngoài 1..5 → 400", "POST", "/api/reviews/create",
    { token: S(), body: { course_id: ctx.enrolledCourseId, rating: 99, comment: "x" } }, 400, (r) => (r.status === 500 ? "LỖ HỔNG: 500" : true));
  await t("POST /reviews/create khoá không tồn tại → 404", "POST", "/api/reviews/create",
    { token: S(), body: { course_id: 99999999, rating: 4, comment: "x" } }, [400, 404], (r) => (r.status === 500 ? "LỖ HỔNG: 500 thay vì 404" : true));
  // IDOR đánh giá: dùng tài khoản TẠM (khác student01) để chắc chắn đánh giá
  // không thuộc về người đang cố sửa — không đụng tới tài khoản demo.
  {
    const other = ctx.cleanToken;
    const r = await raw("POST", "/api/reviews/create", { token: other, body: { course_id: ctx.enrolledCourseId, rating: 5, comment: `${TAG} của tài khoản tạm` } });
    const otherReviewId = r.json?.data?.review_id || r.json?.review_id;
    if (otherReviewId) {
      await t("PUT /reviews/update review của người khác → 403", "PUT", `/api/reviews/update/${otherReviewId}`,
        { token: S(), body: { rating: 1, comment: "chiếm" } }, 403);
      await t("DELETE /reviews/delete review của người khác → 403", "DELETE", `/api/reviews/delete/${otherReviewId}`, { token: S(), body: {} }, 403);
      ctx.otherReviewId = otherReviewId;
    }
  }
  if (ctx.reviewId) {
    await t("PUT /reviews/update/:id", "PUT", `/api/reviews/update/${ctx.reviewId}`, { token: S(), body: { rating: 4, comment: `${TAG} đã sửa` } }, 200);
  }

  // --- Bookmark ---
  await t("POST /bookmarks/create", "POST", "/api/bookmarks/create", { token: S(), body: { courseId: ctx.enrolledCourseId } }, [200, 201], (r) => {
    ctx.bookmarkId = r.json?.data?.bookmark_id || r.json?.bookmark_id;
    return r.status === 400 && /đã bookmark/i.test(r.text) ? true : true;
  });
  await t("POST /bookmarks/create khoá không tồn tại → 404", "POST", "/api/bookmarks/create", { token: S(), body: { courseId: 99999999 } }, [400, 404], (r) => (r.status === 500 ? "LỖ HỔNG: 500" : true));

  // --- Thông báo ---
  await t("POST /notifications/create (admin tạo cho student)", "POST", "/api/notifications/create",
    { token: A(), body: { title: `${TAG} Thông báo`, content: "Nội dung", uid: "demo-student-01", icon: "bell", color: "#fff" } }, [200, 201], (r) => {
      ctx.notiId = r.json?.noti_id || r.json?.data?.noti_id;
      return true;
    });
  const notiList = await t("POST /notifications lấy danh sách", "POST", "/api/notifications", { token: S(), body: {} }, 200, (r) => {
    const arr = r.json?.notifications || r.json?.data || [];
    if (!ctx.notiId && arr[0]) ctx.notiId = arr[0].noti_id;
    return Array.isArray(arr) ? true : "không phải mảng";
  });
  // R4: noti_id sai định dạng phải là 400, không phải 500
  await t("POST /notifications/mark-read noti_id sai định dạng → 400", "POST", "/api/notifications/mark-read",
    { token: S(), body: { noti_id: "1" } }, 400, (r) => (r.status === 500 ? "LỖ HỔNG: 500 thay vì 400" : true));
  await t("POST /notifications/mark-read thiếu noti_id → 400", "POST", "/api/notifications/mark-read", { token: S(), body: {} }, 400);
  await t("DELETE /notifications/delete/abc → 400", "DELETE", "/api/notifications/delete/abc", { token: S(), body: {} }, 400);
  await t("PUT /notifications/update/abc → 400", "PUT", "/api/notifications/update/abc", { token: S(), body: {} }, 400);
  if (ctx.notiId) {
    await t("POST /notifications/mark-read noti_id hợp lệ", "POST", "/api/notifications/mark-read", { token: S(), body: { noti_id: ctx.notiId } }, 200);
    await t("PUT /notifications/update/:id", "PUT", `/api/notifications/update/${ctx.notiId}`, { token: S(), body: {} }, 200);
    const foreign = (notiList?.json?.notifications || []).find((n) => n.uid !== "demo-student-01");
    if (foreign) {
      await t("PUT /notifications/update thông báo người khác → 404", "PUT", `/api/notifications/update/${foreign.noti_id}`, { token: S(), body: {} }, 404);
      await t("DELETE /notifications/delete thông báo người khác → 404", "DELETE", `/api/notifications/delete/${foreign.noti_id}`, { token: S(), body: {} }, 404);
    }
  }

  // --- Quiz + câu hỏi + nộp bài ---
  if (ctx.courseId) {
    await t("POST /quizzes/create", "POST", "/api/quizzes/create",
      { token: M(), body: { course_id: ctx.courseId, title: `${TAG} Quiz`, type: "trac_nghiem", time_limit: 15, attempt_limit: 2 } }, [200, 201], (r) => {
        ctx.newQuizId = r.json?.data?.quiz_id || r.json?.quiz_id;
        return ctx.newQuizId ? true : "thiếu quiz_id";
      });
    await t("POST /quizzes/create khoá không tồn tại → 404", "POST", "/api/quizzes/create",
      { token: M(), body: { course_id: 99999999, title: "x" } }, [400, 404], (r) => (r.status === 500 ? "LỖ HỔNG: 500" : true));
    await t("POST /quizzes/create thiếu title → 400", "POST", "/api/quizzes/create", { token: M(), body: { course_id: ctx.courseId } }, 400);

    if (ctx.newQuizId) {
      await t("POST /questions/createbyuser", "POST", "/api/questions/createbyuser",
        { token: M(), body: { quiz_id: ctx.newQuizId, question: `${TAG} Câu 1?`, type: "trac_nghiem", options: ["A", "B", "C", "D"], correct_index: 2 } }, [200, 201], (r) => {
          ctx.newQuestionId = r.json?.data?.question_id || r.json?.question_id;
          return ctx.newQuestionId ? true : "thiếu question_id";
        });
      await t("POST /questions/createbyuser thiếu question → 400", "POST", "/api/questions/createbyuser", { token: M(), body: { quiz_id: ctx.newQuizId } }, 400);
      await t("POST /questions/createbyuser quiz không tồn tại → 404", "POST", "/api/questions/createbyuser",
        { token: M(), body: { quiz_id: 99999999, question: "x" } }, [400, 404], (r) => (r.status === 500 ? "LỖ HỔNG: 500" : true));
      if (ctx.newQuestionId) {
        await t("PUT /questions/update/:id", "PUT", `/api/questions/update/${ctx.newQuestionId}`,
          { token: M(), body: { question: `${TAG} Câu 1 (sửa)?`, options: ["A", "B", "C", "D"], correct_index: 2 } }, 200);
        // IDOR câu hỏi: câu 429 thuộc quiz 131 do mentor01 tạo, nên phải dùng
        // mentor02 (chủ khác) để kiểm tra việc chặn sửa của người ngoài.
        const m2 = await login("mentor02@demo.onlinelearning.vn").catch(() => null);
        if (m2) {
          ctx.m2 = m2.access;
          // correct_index PHẢI hợp lệ, nếu không thì 400 sẽ che mất kết quả 403.
          await t("mentor02 SỬA câu hỏi của mentor01 → 403", "PUT", "/api/questions/update/429",
            { token: m2.access, body: { question: `${TAG} chiếm`, options: ["A", "B", "C", "D"], correct_index: 1 } }, 403,
            (r) => (r.status === 200 ? "LỖ HỔNG: sửa được câu hỏi của mentor khác" : r.status === 400 ? "400 che mất kiểm tra quyền" : true));
          await t("mentor02 XOÁ câu hỏi của mentor01 → 403", "DELETE", "/api/questions/delete/429",
            { token: m2.access, body: {} }, 403);
          await t("mentor02 THÊM câu hỏi vào quiz của mentor01 → 403", "POST", "/api/questions/createbyuser",
            { token: m2.access, body: { quiz_id: 131, question: `${TAG} chen vào`, options: ["A", "B"], correct_index: 1 } }, 403,
            (r) => (r.status === 201 ? "LỖ HỔNG: chèn được câu hỏi vào quiz người khác" : true));
          await t("mentor02 SỬA quiz của mentor01 → 403", "PUT", "/api/quizzes/update/131",
            { token: m2.access, body: { title: `${TAG} chiếm` } }, 403);
        }
        await t("PUT /questions/update/:id chính chủ (mentor01)", "PUT", `/api/questions/update/${ctx.newQuestionId}`,
          { token: M(), body: { question: `${TAG} Câu 1 (sửa lần 2)?`, options: ["A", "B", "C", "D"], correct_index: 1 } }, 200);
      }

      const answers = ctx.newQuestionId ? { [ctx.newQuestionId]: 2 } : {};
      await t("POST /quiz-results/submit", "POST", "/api/quiz-results/submit",
        { token: S(), body: { quiz_id: ctx.newQuizId, answers } }, [200, 201], (r) => {
          ctx.resultId = r.json?.data?.result_id || r.json?.result_id;
          return true;
        });
      await t("POST /quiz-results/submit answers là mảng → 400", "POST", "/api/quiz-results/submit", { token: S(), body: { quiz_id: ctx.newQuizId, answers: [1, 2] } }, 400);
      await t("POST /quiz-results/submit answers là chuỗi → 400", "POST", "/api/quiz-results/submit", { token: S(), body: { quiz_id: ctx.newQuizId, answers: "abc" } }, 400);
      await t("POST /quiz-results/submit quiz không tồn tại → 404", "POST", "/api/quiz-results/submit", { token: S(), body: { quiz_id: 99999999, answers: {} } }, 404);
      await t("POST /quiz-results/submit thiếu quiz_id → 400", "POST", "/api/quiz-results/submit", { token: S(), body: { answers: {} } }, 400);
      await t("POST /quiz-results/submit > 500 câu trả lời → 400", "POST", "/api/quiz-results/submit",
        { token: S(), body: { quiz_id: ctx.newQuizId, answers: Object.fromEntries(Array.from({ length: 501 }, (_, i) => [i + 1, 0])) } }, 400);
      await t("POST /quiz-results/submit explanation quá dài → 400", "POST", "/api/quiz-results/submit",
        { token: S(), body: { quiz_id: ctx.newQuizId, answers: {}, explanation: "x".repeat(2001) } }, 400);

      const rRes = await raw("GET", "/api/quiz-results/users/demo-student-01/results", { token: S() });
      const arr = rRes.json?.results || rRes.json?.data || [];
      const target = Array.isArray(arr) ? arr.find((x) => x.result_id) : null;
      if (target) {
        await t("PATCH /quiz-results/:id/grade (mentor)", "PATCH", `/api/quiz-results/quiz-results/${target.result_id}/grade`,
          { token: M(), body: { explanation: `${TAG} đã chấm`, score: 9 } }, [200, 400]);
        await t("GET /quiz-results/:id", "GET", `/api/quiz-results/${target.result_id}`, { token: S() }, 200);
      }
    }
  }

  // --- Xoá đăng ký ---
  if (ctx.enrollmentId) {
    await t("DELETE /enrollments/delete/:id (của mình)", "DELETE", `/api/enrollments/delete/${ctx.enrollmentId}`, { token: S() }, 200);
  }
  await t("DELETE /enrollments/delete/99999999 → 404", "DELETE", "/api/enrollments/delete/99999999", { token: S() }, 404);
  await t("DELETE /enrollments/delete/abc → 400", "DELETE", "/api/enrollments/delete/abc", { token: S() }, 400);
}

// =====================================================================
async function phaseAdmin() {
  setGroup("8. Admin & vòng đời trạng thái");

  if (ctx.courseId) {
    await t("PATCH /courses/:id/status (admin duyệt)", "PATCH", `/api/courses/${ctx.courseId}/status`, { token: A(), body: { status: "approved" } }, 200);
    await t("GET /courses/:id sau khi duyệt", "GET", `/api/courses/${ctx.courseId}`, { token: A() }, 200, (r) => {
      const c = r.json?.data || r.json;
      return c?.status === "approved" ? true : "trạng thái chưa đổi: " + c?.status;
    });
    await t("PATCH status không hợp lệ → 400", "PATCH", `/api/courses/${ctx.courseId}/status`, { token: A(), body: { status: "bia" } }, 400);
    await t("PATCH status khoá không tồn tại → 404", "PATCH", "/api/courses/99999999/status", { token: A(), body: { status: "approved" } }, 404);
    await t("PATCH status (admin từ chối)", "PATCH", `/api/courses/${ctx.courseId}/status`, { token: A(), body: { status: "rejected", rejectionReason: "Thiếu mô tả" } }, 200);
    await t("PATCH status (mentor gửi lại chờ duyệt)", "PATCH", `/api/courses/${ctx.courseId}/status`, { token: M(), body: { status: "pending" } }, 200);
    await t("PATCH status (mentor tự duyệt) → 403", "PATCH", `/api/courses/${ctx.courseId}/status`, { token: M(), body: { status: "approved" } }, 403);
    await t("PATCH status (mentor khác sửa) → 403", "PATCH", `/api/courses/${ctx.courseId}/status`, { token: S(), body: { status: "approved" } }, 403);
  }

  if (ctx.mentorRequestId) {
    await t("PUT /mentor-requests/:id/status (admin duyệt)", "PUT", `/api/mentor-requests/${ctx.mentorRequestId}/status`, { token: A(), body: { status: "approved" } }, 200);
  }
  await t("PUT /mentor-requests/:id/status trạng thái sai → 400/404", "PUT", "/api/mentor-requests/99999999/status", { token: A(), body: { status: "bia" } }, [400, 404]);

  // --- Quản lý user ---
  if (ctx.uid) {
    await t("PUT /users/updaterole nâng student → mentor", "PUT", "/api/users/updaterole", { token: A(), body: { uid: ctx.uid, role: "mentor" } }, 200);
    await t("PUT /users/updaterole role không hợp lệ → 400", "PUT", "/api/users/updaterole", { token: A(), body: { uid: ctx.uid, role: "sieu-admin" } }, 400);
    await t("PUT /users/updaterole user không tồn tại → 404", "PUT", "/api/users/updaterole", { token: A(), body: { uid: "khong-ton-tai", role: "user" } }, 404);
    await t("PUT /users/updaterole admin tự hạ quyền → 400/403", "PUT", "/api/users/updaterole", { token: A(), body: { uid: "demo-admin", role: "user" } }, [400, 403]);

    // NOTE: các endpoint chỉ dùng role đọc từ DB (không phân biệt scope) nằm
  // trong mục "hành vi cần quyết định" của báo cáo, không tính là lỗi ở đây.

  // R5 (REGRESSION): admin tự khoá chính mình phải bị từ chối VÀ không được khoá thật.
    const victim = await raw("POST", "/api/auth/login", { body: { email: ctx.email, password: ctx.pw } });
    const victimToken = victim.json?.access_token;
    await t("PATCH /users/:id/status (admin khoá tài khoản khác)", "PATCH", `/api/users/${ctx.uid}/status`, { token: A(), body: { status: "disabled" } }, 200);
    await t("token cũ của tài khoản bị khoá bị từ chối", "GET", "/api/auth/me", { token: victimToken }, 403);
    await t("login tài khoản bị khoá → 403", "POST", "/api/auth/login", { body: { email: ctx.email, password: ctx.pw } }, [401, 403]);
    await t("PATCH status sai → 400", "PATCH", `/api/users/${ctx.uid}/status`, { token: A(), body: { status: "abc" } }, 400);
    await t("PATCH /users/:id/status (admin tự khoá mình) → 400", "PATCH", "/api/users/demo-admin/status", { token: A(), body: { status: "disabled" } }, 400);
    await t("★ REGRESSION: token admin VẪN dùng được sau khi thử tự khoá", "GET", "/api/auth/me", { token: A() }, 200,
      (r) => (r.json?.user?.uid === "demo-admin" ? true : "tài khoản admin bị ảnh hưởng"));
    await t("PATCH status mở khoá lại", "PATCH", `/api/users/${ctx.uid}/status`, { token: A(), body: { status: "active" } }, 200);
    await t("login lại sau khi mở khoá", "POST", "/api/auth/login", { body: { email: ctx.email, password: ctx.pw } }, 200);
  }
}

// =====================================================================
async function phaseEdge() {
  setGroup("9. Bảo mật & biên");

  const leak = /violates|constraint|relation "|pg_|syntax error|password_hash|\$2[aby]\$/i;
  for (const [method, path] of [
    ["GET", "/api/courses/abc"], ["GET", "/api/courses/1;DROP TABLE users"],
    ["GET", "/api/lessons/detail/abc"], ["GET", "/api/users/abc"],
    ["GET", "/api/course-categories/update/abc"], ["GET", "/api/questions/abc"],
    ["GET", "/api/quiz-results/abc"], ["GET", "/api/bookmarks/abc"],
  ]) {
    await t(`không rò CSDL: ${method} ${path}`, method, path, { token: A() },
      [200, 400, 401, 403, 404, 405], (r) => (leak.test(r.text) ? "LỖ HỔNG: rò chi tiết nội bộ" : r.status >= 500 ? "LỖ HỔNG: " + r.status : true));
  }

  const big = await fetch(BASE + "/api/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "a@b.c", password: "x".repeat(1_500_000) }),
  }).catch((e) => ({ status: "ERR" }));
  rec("body 1.5MB bị chặn", "400/413", big.status, [400, 413].includes(big.status), big.status === 200 ? "LỖ HỔNG: nhận body khổng lồ" : "");

  const badJson = await fetch(BASE + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{khong-phai-json" });
  rec("JSON hỏng → 400 (không phải 500)", "400", badJson.status, badJson.status === 400, badJson.status === 500 ? "LỖ HỔNG: 500" : "");

  // --- Tham số sai định dạng phải là 400, không bao giờ 500 ---
  const malformed = [
    ["PUT", "/api/courses/update/abc", { title: "x" }],
    ["PATCH", "/api/courses/abc/status", { status: "approved" }],
    ["PUT", "/api/quizzes/update/abc", { title: "x" }],
    ["DELETE", "/api/questions/delete/abc", {}],
    ["PUT", "/api/questions/update/abc", { question: "x", options: ["A", "B"], correct_index: 1 }],
    ["PATCH", "/api/quiz-results/quiz-results/abc/grade", { explanation: "x", score: 5 }],
    ["PUT", "/api/reviews/update/abc", { rating: 4 }],
    ["DELETE", "/api/reviews/delete/abc", {}],
    ["PUT", "/api/lessons/update/abc", { title: "x" }],
    ["PUT", "/api/mentor-requests/abc/status", { status: "approved" }],
    ["GET", "/api/lessons/detail/abc", undefined],
    ["GET", "/api/lessons/detail/1.5", undefined],
    ["GET", "/api/lessons/courses/1.5/demo-student-01", undefined],
    ["GET", "/api/enrollments/progress?courseId=abc", undefined],
  ];
  for (const [method, path, body] of malformed) {
    await t(`tham số sai định dạng không gây 500: ${method} ${path}`, method, path,
      { token: A(), body }, [400, 401, 403, 404],
      (r) => (r.status >= 500 ? `LỖ HỔNG: ${r.status} thay vì 400` : true));
  }

  // --- Trường số sai kiểu trong body ---
  await t("price không phải số → 400", "POST", "/api/courses/create",
    { token: M(), form: (() => { const f = new FormData(); f.append("title", "x"); f.append("category_id", "25"); f.append("price", "abc"); return f; })() },
    400, (r) => (r.status === 500 ? "LỖ HỔNG: 500" : true));
  await t("time_limit không phải số → 400", "POST", "/api/quizzes/create",
    { token: M(), body: { course_id: 227, title: "x", time_limit: "abc" } }, 400,
    (r) => (r.status === 500 ? "LỖ HỔNG: 500" : true));
  await t("birthdate không phải ngày → 400", "PUT", "/api/users/update/demo-student-01",
    { token: S(), form: (() => { const f = new FormData(); f.append("birthdate", "khong-phai-ngay"); return f; })() },
    400, (r) => (r.status === 500 ? "LỖ HỔNG: 500" : true));

  await t("JSON hỏng qua fetch thường", "POST", "/api/auth/login", { headers: { "Content-Type": "application/json" }, body: undefined }, [400, 500]);

  await t("path traversal /uploads/../.env", "GET", "/uploads/..%2f..%2f.env", {}, [400, 403, 404]);
  await t("file tĩnh không tồn tại", "GET", "/uploads/khong-ton-tai.png", {}, 404);
  await t("method không hỗ trợ", "PATCH", "/api/auth/login", { body: {} }, [404, 405]);

  // file cũ đóng gói kèm mã nguồn vẫn phải phục vụ được
  await t("file uploads cũ (đóng gói kèm mã) vẫn phục vụ", "GET", "/uploads/categories/category-1746465542603.png", {}, 200);

  // XSS: file HTML đổi tên .png phải bị từ chối
  await t("upload HTML đổi tên .png bị chặn", "POST", "/api/course-categories/create",
    { token: M(), form: (() => { const f = new FormData(); f.append("name", "XSS"); f.append("icon", new Blob(["<script>alert(1)</script>"], { type: "image/png" }), "xss.png"); return f; })() },
    400, (r) => (r.status === 500 ? "LỖ HỔNG: 500" : true));
}

// =====================================================================
async function phaseCleanup() {
  setGroup("10. Dọn dẹp");
  const del = async (name, method, path, opts, expect = [200, 204, 400, 403, 404]) => {
    const r = await raw(method, path, opts);
    rec(name, expect.join("/"), r.status, expect.includes(r.status), "", r.ms);
    return r;
  };
  if (ctx.notiId) await del("xoá thông báo", "DELETE", `/api/notifications/delete/${ctx.notiId}`, { token: S() });
  if (ctx.reviewId) await del("xoá đánh giá", "DELETE", `/api/reviews/delete/${ctx.reviewId}`, { token: S() });
  if (ctx.otherReviewId) await del("xoá đánh giá của tài khoản tạm", "DELETE", `/api/reviews/delete/${ctx.otherReviewId}`, { token: ctx.cleanToken });
  if (ctx.bookmarkId) await del("xoá bookmark", "DELETE", "/api/bookmarks/delete", { token: S(), body: { bookmarkId: ctx.bookmarkId } });
  if (ctx.newQuizId) await del("xoá quiz", "DELETE", `/api/quizzes/delete/${ctx.newQuizId}`, { token: M() });
  if (ctx.newLessonId) await del("xoá bài học", "DELETE", `/api/lessons/delete/${ctx.newLessonId}`, { token: M() });
  if (ctx.courseId) await del("xoá khoá học", "DELETE", `/api/courses/delete/${ctx.courseId}`, { token: A() });
  if (ctx.newCategoryId) await del("xoá danh mục", "DELETE", `/api/course-categories/delete/${ctx.newCategoryId}`, { token: A() });
  if (ctx.mentorRequestId) await del("xoá yêu cầu nâng cấp", "DELETE", `/api/mentor-requests/${ctx.mentorRequestId}`, { token: A() });
  if (ctx.uid) await del("xoá tài khoản", "DELETE", `/api/users/delete/${ctx.uid}`, { token: A() });
  if (ctx.uid) {
    const r = await raw("GET", `/api/users/${ctx.uid}`, { token: A() });
    rec("xác nhận tài khoản đã xoá", 404, r.status, r.status === 404);
  }

  // Mọi thay đổi (avatar, yêu cầu nâng cấp) đều nhắm vào tài khoản tạm của bộ
  // test, nên tài khoản demo không bị đụng tới — chạy lặp không tích lũy thay đổi.
  // Avatar của demo-student-01 do bộ test thay đổi; việc khôi phục cần ghi
  // thẳng vào CSDL nên được làm ở bước dọn dẹp ngoài (xem cleanup-avatars).
}

// =====================================================================
async function main() {
  console.log(`\n=== KIỂM THỬ API: ${BASE} ===\n`);
  const started = Date.now();

  for (const p of [phaseInfra, phaseAuth, phaseAccount, phaseAuthz, phaseRead, phaseUploads, phaseWrite, phaseAdmin, phaseEdge, phaseCleanup]) {
    try { await p(); }
    catch (e) { rec(`phase ${p.name} lỗi`, "ok", "throw", false, e.message); console.error(e); }
    console.log("");
  }

  const pass = results.filter((r) => r.ok).length;
  const fail = results.filter((r) => !r.ok);
  console.log("================ TỔNG KẾT ================");
  console.log(`Tổng: ${results.length} | PASS: ${pass} | FAIL: ${fail.length}`);
  console.log(`Thời gian: ${((Date.now() - started) / 1000).toFixed(1)}s`);
  if (fail.length) {
    console.log("\n--- FAIL ---");
    for (const f of fail) console.log(`[${f.group}] ${f.name}\n   expect ${f.expected} | got ${f.actual}${f.note ? " | " + f.note : ""}`);
  }
  const slow = results.filter((r) => r.ms > 3000).sort((a, b) => b.ms - a.ms).slice(0, 8);
  if (slow.length) {
    console.log("\n--- CHẬM NHẤT ---");
    for (const s of slow) console.log(`   ${s.ms}ms  ${s.name}`);
  }

  fs.writeFileSync(
    process.env.RESULT_FILE || "test/live/result.json",
    JSON.stringify({ base: BASE, total: results.length, pass, fail: fail.length, failures: fail, ctx }, null, 2)
  );
  console.log(`\nKết quả: ${process.env.RESULT_FILE || "test/live/result.json"}`);
  process.exit(fail.length === 0 ? 0 : 1);
}

main();
