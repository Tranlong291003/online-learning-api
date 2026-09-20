/**
 * AUTHZ PROBE — kiểm tra phân quyền trên server thật.
 *
 * ⚠️ NGUYÊN TẮC AN TOÀN
 *  - Mọi request GHI chỉ nhắm vào dữ liệu do chính script này tạo (user test, khóa học test).
 *  - KHÔNG bao giờ nhắm vào dữ liệu thật (24 khóa học, user mentor thật).
 *  - Cuối script luôn kiểm tra lại user thật + đếm bảng để phát hiện đụng nhầm.
 *
 * Bối cảnh: API có HAI nguồn role khác nhau —
 *   (a) role nhúng trong JWT  -> controller đọc `req.user.role`
 *   (b) role trong bảng users -> controller chạy `SELECT role FROM users`
 * Script này kiểm tra cả hai, và kiểm tra điều gì xảy ra khi hai nguồn lệch nhau.
 *
 * Chạy (server phải đang chạy):
 *   node scripts/live-authz-probe.cjs
 */
require("dotenv").config();
const jwt = require("jsonwebtoken");
const { Client } = require("pg");

const BASE = process.env.PROBE_BASE || "http://localhost:4001";
const REAL_UID = "abb8127b-fc22-466e-8473-51000b7f2114";
const REAL_EMAIL = "mentor.demo@onlinelearning.vn";
const TAG = `AUTHZ-${Date.now()}`;

const tok = (uid, role, email) =>
  jwt.sign({ uid, email: email || `${TAG}@test.local`, role }, process.env.JWT_SECRET, { expiresIn: "1h" });

// Token "ma": uid KHÔNG tồn tại trong DB nhưng token khai role admin.
// Dùng để trả lời: API có tin role trong token mà không đối chiếu DB không?
const GHOST_ADMIN = tok(`ghost-${TAG}`, "admin");
const EXPIRED = jwt.sign({ uid: REAL_UID, role: "admin" }, process.env.JWT_SECRET, { expiresIn: "-1h" });
const WRONG_SECRET = jwt.sign({ uid: REAL_UID, role: "admin" }, "secret-sai-hoan-toan", { expiresIn: "1h" });

let db;
const created = { uids: [], courseId: null, categoryId: null };
const T = {}; // adminTok, userTok, realMentorTok
let pass = 0,
  fail = 0;
const findings = [];

async function call(label, method, path, token, body, expected, note) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  let status, text;
  try {
    const res = await fetch(BASE + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    status = res.status;
    text = await res.text();
  } catch (e) {
    status = "ERR";
    text = e.message;
  }
  const ok = expected.includes(status);
  ok ? pass++ : fail++;
  console.log(`${ok ? "OK  " : "FAIL"} ${label.padEnd(56)} -> ${status} (mong đợi ${expected.join("/")})`);
  if (!ok) {
    findings.push({ label, method, path, status, expected, note, detail: String(text).slice(0, 220) });
    console.log(`        ${String(text).slice(0, 220)}`);
  }
  return { status, text };
}

async function apiJson(method, path, token, body) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* body không phải JSON */
  }
  return { status: res.status, json, text };
}

(async () => {
  db = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();
  console.log(`\n=== AUTHZ PROBE (${TAG}) ===\n`);

  // ---------- Dựng dữ liệu test ----------
  const realMentorTok = tok(REAL_UID, "mentor", REAL_EMAIL);
  T.realMentor = realMentorTok;

  async function makeUser(role) {
    const r = await apiJson("POST", "/api/users/create", realMentorTok, {
      email: `${TAG}-${role}@example.com`,
      password: "Test123456!",
      name: `Authz ${role}`,
    });
    const uid = r.json?.user_id;
    if (!uid) throw new Error("Không tạo được user test: " + r.text.slice(0, 200));
    created.uids.push(uid);
    await db.query("UPDATE users SET role = $1 WHERE uid = $2", [role, uid]);
    return uid;
  }

  const adminUid = await makeUser("admin");
  const normalUid = await makeUser("user");
  T.admin = tok(adminUid, "admin", `${TAG}-admin@example.com`);
  T.user = tok(normalUid, "user", `${TAG}-user@example.com`);

  const cat = await apiJson("POST", "/api/course-categories/create", realMentorTok, {
    name: `${TAG}-cat`,
    description: "authz",
  });
  created.categoryId = cat.json?.data?.category_id ?? cat.json?.category_id;

  const cr = await apiJson("POST", "/api/courses/create", realMentorTok, {
    title: `${TAG}-course`,
    description: "authz",
    category_id: created.categoryId,
    level: "beginner",
    price: 0,
    language: "vi",
  });
  created.courseId = cr.json?.course?.course_id;

  // Khóa học thứ hai do USER TEST (admin) làm chủ — để kiểm tra mentor thật có xoá được
  // khóa học của người khác không (nếu dùng khóa của chính mentor thì 200 là ĐÚNG).
  const cr2 = await apiJson("POST", "/api/courses/create", T.admin, {
    title: `${TAG}-foreign-course`,
    description: "authz foreign owner",
    category_id: created.categoryId,
    level: "beginner",
    price: 0,
    language: "vi",
  });
  created.foreignCourseId = cr2.json?.course?.course_id;

  console.log(`  user test: admin=${adminUid}, user=${normalUid}`);
  console.log(
    `  khóa học test=${created.courseId} (chủ: mentor thật), ${created.foreignCourseId} (chủ: user test)`
  );
  console.log(`  danh mục test=${created.categoryId}\n`);
  if (!created.courseId || !created.foreignCourseId) {
    throw new Error("Không tạo được khóa học test: " + (cr.text + cr2.text).slice(0, 300));
  }

  // =====================================================================
  // 1) USER THƯỜNG (role DB = user) có vượt quyền không?
  // =====================================================================
  console.log("--- 1) user thường không được vượt quyền ---");
  await call("đọc danh sách users", "GET", "/api/users/", T.user, undefined, [403]);
  await call("đọc mentor-requests", "GET", "/api/mentor-requests/", T.user, undefined, [403]);
  await call("xoá khóa học test", "DELETE", `/api/courses/delete/${created.courseId}`, T.user, undefined, [403]);
  await call("đổi status khóa học test", "PATCH", `/api/courses/${created.courseId}/status`, T.user, { status: "approved" }, [403]);
  await call("đổi role user khác", "PUT", "/api/users/updaterole", T.user, { uid: adminUid, role: "user" }, [403]);
  await call("xoá user khác", "DELETE", `/api/users/delete/${adminUid}`, T.user, undefined, [403]);
  await call("đổi status user khác", "PATCH", `/api/users/${adminUid}/status`, T.user, { status: "disabled" }, [403]);
  // mentor thật xoá khóa học của NGƯỜI KHÁC (khóa do user test làm chủ) -> phải 403
  await call(
    "mentor xoá khóa học người khác",
    "DELETE",
    `/api/courses/delete/${created.foreignCourseId}`,
    realMentorTok,
    undefined,
    [403]
  );
  await call("mentor đọc mentor-requests", "GET", "/api/mentor-requests/", realMentorTok, undefined, [403]);

  // =====================================================================
  // 2) TOKEN HỎNG
  // =====================================================================
  console.log("\n--- 2) token hết hạn / sai chữ ký / rác / thiếu ---");
  await call("token hết hạn", "GET", "/api/users/", EXPIRED, undefined, [401]);
  await call("token ký bằng secret sai", "GET", "/api/users/", WRONG_SECRET, undefined, [401]);
  await call("token rác", "GET", "/api/users/", "khong-phai-token", undefined, [401]);
  await call("không có token", "GET", "/api/users/", null, undefined, [401]);
  await call("token hết hạn, endpoint kiểm tra role từ DB", "PATCH", `/api/courses/${created.foreignCourseId}/status`, EXPIRED, { status: "approved" }, [401]);

  // =====================================================================
  // 3) HAI NGUỒN ROLE LỆCH NHAU (phát hiện thiết kế)
  // =====================================================================
  console.log("\n--- 3) token khai admin nhưng uid KHÔNG có trong DB ---");
  // Với endpoint chỉ đọc req.user.role, token này qua được. Không phải lỗ hổng có thể
  // khai thác từ ngoài (phải có JWT_SECRET mới ký được), nhưng là thiếu phòng thủ nhiều lớp.
  await call("ghost admin: đọc danh sách users", "GET", "/api/users/", GHOST_ADMIN, undefined, [401], "TOKEN_ROLE_TRUSTED");
  await call("ghost admin: đọc mentor-requests", "GET", "/api/mentor-requests/", GHOST_ADMIN, undefined, [401], "TOKEN_ROLE_TRUSTED");
  await call("ghost admin: xoá khóa học test", "DELETE", `/api/courses/delete/${created.foreignCourseId}`, GHOST_ADMIN, undefined, [401], "DB_CHECKED");
  await call("ghost admin: đổi status khóa học test", "PATCH", `/api/courses/${created.foreignCourseId}/status`, GHOST_ADMIN, { status: "approved" }, [401], "DB_CHECKED");

  // =====================================================================
  // 4) THU HỒI QUYỀN: token cũ còn dùng được không? (vấn đề thật)
  // =====================================================================
  console.log("\n--- 4) hạ quyền admin -> user, token CŨ còn hiệu lực không? ---");
  const beforeDemote = await apiJson("GET", "/api/users/", T.admin, undefined);
  await db.query("UPDATE users SET role = 'user' WHERE uid = $1", [adminUid]);

  const afterTokenEndpoint = await apiJson("GET", "/api/users/", T.admin, undefined);
  const tokenStillWorks = afterTokenEndpoint.status === 200;
  console.log(
    `${tokenStillWorks ? "FAIL" : "OK  "} token cũ (khai admin) đọc /api/users/ sau khi bị hạ quyền -> ${afterTokenEndpoint.status}`
  );
  if (tokenStillWorks) {
    fail++;
    findings.push({
      note: "STALE_TOKEN_ROLE",
      label: "Thu hồi quyền không có hiệu lực với endpoint kiểm tra role từ token",
      detail:
        `Trước khi hạ: ${beforeDemote.status}. Sau khi DB đã hạ role xuống 'user': vẫn ${afterTokenEndpoint.status}. ` +
        "Nguyên nhân: role nằm trong JWT (hạn 7 ngày) và controller đọc req.user.role mà không đối chiếu DB. " +
        "Hệ quả: admin bị cách chức vẫn giữ quyền admin tới khi token hết hạn.",
    });
  } else pass++;

  await call("token cũ (khai admin) đổi status khóa học", "PATCH", `/api/courses/${created.foreignCourseId}/status`, T.admin, { status: "approved" }, [403], "DB_ROLE_FRESH");

  // =====================================================================
  // 4b) KHOÁ TÀI KHOẢN có hiệu lực ngay không? (nghiêm trọng hơn cả role)
  // =====================================================================
  console.log("\n--- 4b) khoá tài khoản (is_active=false) — token cũ còn dùng được không? ---");
  const beforeBan = await apiJson("GET", "/api/users/" + normalUid, T.user, undefined);
  await db.query("UPDATE users SET is_active = false WHERE uid = $1", [normalUid]);
  const afterBan = await apiJson("GET", "/api/users/" + normalUid, T.user, undefined);
  const banWorks = [401, 403].includes(afterBan.status);
  console.log(`${banWorks ? "OK  " : "FAIL"} user bị khoá gọi API -> ${afterBan.status} (trước khi khoá: ${beforeBan.status})`);
  if (!banWorks) {
    fail++;
    findings.push({
      note: "BANNED_USER_STILL_WORKS",
      label: "Tài khoản bị khoá vẫn dùng được API tới khi token hết hạn",
      detail:
        `Sau khi DB đặt is_active=false, token cũ vẫn nhận ${afterBan.status}. ` +
        "auth.middleware chỉ verify chữ ký JWT, không kiểm tra is_active trong DB. " +
        "is_active chỉ được kiểm lúc đăng nhập (loginUser). Hệ quả: tài khoản bị khoá vẫn truy cập được tối đa 7 ngày.",
    });
  } else pass++;
  await db.query("UPDATE users SET is_active = true WHERE uid = $1", [normalUid]);

  // =====================================================================
  // 5) DỮ LIỆU THẬT CÒN NGUYÊN?
  // =====================================================================
  console.log("\n--- 5) xác nhận dữ liệu thật không bị đụng ---");
  const real = await db.query("SELECT id, uid, role::text, is_active FROM users WHERE uid = $1", [REAL_UID]);
  const ru = real.rows[0];
  const realOk = ru?.role === "mentor" && ru?.is_active === true;
  console.log(`${realOk ? "OK  " : "FAIL"} user thật: role=${ru?.role} is_active=${ru?.is_active}`);
  realOk ? pass++ : (fail++, findings.push({ note: "DATA_INTEGRITY", label: "DỮ LIỆU THẬT BỊ THAY ĐỔI", detail: JSON.stringify(ru) }));

  // Đếm khóa học THẬT (loại trừ khóa do test tạo) — phải đúng 24, không phụ thuộc số test đang tồn tại.
  const cc = await db.query("SELECT count(*)::int n FROM courses WHERE title NOT LIKE $1", [`${TAG}%`]);
  const courseOk = cc.rows[0].n === 24;
  console.log(`${courseOk ? "OK  " : "FAIL"} số khóa học thật: ${cc.rows[0].n} (mong đợi 24)`);
  courseOk ? pass++ : (fail++, findings.push({ note: "DATA_INTEGRITY", label: "Số khóa học sai", detail: String(cc.rows[0].n) }));

  // ---------- DỌN DẸP ----------
  console.log("\n--- cleanup ---");
  // khôi phục quyền admin cho user test để tự xoá được chính nó
  await db.query("UPDATE users SET role = 'admin' WHERE uid = $1", [adminUid]);
  const delCourse = await apiJson("DELETE", `/api/courses/delete/${created.foreignCourseId}`, T.admin, undefined);
  console.log(`  xoá khóa học test -> ${delCourse.status}`);
  const delCat = await apiJson("DELETE", `/api/course-categories/delete/${created.categoryId}`, realMentorTok, { uid: REAL_UID });
  console.log(`  xoá danh mục test -> ${delCat.status}`);
  // Xoá theo thứ tự NGƯỢC: user thường trước, admin sau cùng. Nếu xoá user admin
  // trước thì token dùng để xoá lập tức mất hiệu lực (middleware đối chiếu DB).
  for (const uid of [...created.uids].reverse()) {
    const d = await apiJson("DELETE", `/api/users/delete/${uid}`, T.admin, undefined);
    console.log(`  xoá user test ${uid} -> ${d.status}`);
  }
  // dọn side-effect do controller tự sinh
  const noti = await db.query("DELETE FROM notifications WHERE content LIKE $1 OR title LIKE $1", [`%${TAG}%`]);
  if (noti.rowCount) console.log(`  dọn ${noti.rowCount} notification side-effect`);
  await db.query("DELETE FROM course_categories WHERE name LIKE $1", [`${TAG}%`]);
  await db.query("DELETE FROM courses WHERE title LIKE $1", [`${TAG}%`]);
  await db.query("DELETE FROM users WHERE email LIKE $1", [`${TAG}%`]);
  await db.query("DELETE FROM users WHERE uid LIKE $1", [`ghost-${TAG}%`]);
  // an toàn: nếu vì lý do nào đó user thật bị đổi role, khôi phục
  await db.query("UPDATE users SET role = 'mentor' WHERE uid = $1 AND role <> 'mentor'", [REAL_UID]);

  const fin = await db.query(
    `SELECT (SELECT count(*)::int FROM users) u,
            (SELECT count(*)::int FROM courses) c,
            (SELECT count(*)::int FROM course_categories) cat,
            (SELECT count(*)::int FROM notifications) n,
            (SELECT role::text FROM users WHERE uid = $1) r`,
    [REAL_UID]
  );
  console.log(`  sau dọn: ${JSON.stringify(fin.rows[0])}`);
  await db.end();

  console.log(`\n================ AUTHZ: ${pass} pass, ${fail} fail ================`);
  if (findings.length) {
    console.log("\n--- PHÁT HIỆN ---");
    findings.forEach((f) => console.log(`  [${f.note || "?"}] ${f.label} -> ${f.status ?? "-"}`));
    console.log("\n--- CHI TIẾT ---");
    findings.forEach((f) => console.log(`  [${f.note || "?"}] ${f.detail || ""}`));
  }
  process.exit(fail ? 1 : 0);
})().catch(async (e) => {
  console.error("EXCEPTION:", e.message);
  try {
    await db?.end();
  } catch {
    /* đã đóng */
  }
  process.exit(2);
});
