/**
 * Probe từng endpoint đọc trên server THẬT (cổng 4001) + DB Supabase THẬT.
 * Chỉ GET/POST đọc dữ liệu, không tạo/xóa gì (trừ POST /api/app-stats vốn chỉ đọc).
 */
require("dotenv").config();
const jwt = require("jsonwebtoken");

const BASE = process.env.PROBE_BASE || "http://localhost:4001";
const UID = "abb8127b-fc22-466e-8473-51000b7f2114"; // user duy nhất trong DB thật
const SECRET = process.env.JWT_SECRET;

const { signToken } = require("./lib/signToken.cjs");

const mk = (role) => signToken({ uid: UID, email: "mentor.demo@onlinelearning.vn", role });
const adminToken = mk("admin");
const mentorToken = mk("mentor");
const userToken = mk("user");

// LƯU Ý: sau khi vá lỗ hổng "quyền bị thu hồi vẫn dùng được", middleware xác thực lấy
// role từ DB (nguồn chân lý) chứ không tin role trong token. User thật duy nhất trong DB
// có role 'mentor', nên adminToken (chỉ khai role admin trong token) KHÔNG còn qua được
// các endpoint admin-only — trả 403 là ĐÚNG. Việc admin thật truy cập được các endpoint
// này được kiểm tra riêng trong `npm run api:authz` (có tạo user admin thật trong DB).

const COURSE = 76, LESSON = 254, QUIZ = 31;

const checks = [
  ["GET", "/health", null, null, [200]],
  ["POST", "/api/app-stats", { uid: UID }, null, [401]], // route có auth -> thiếu token phải là 401
  ["POST", "/api/app-stats", { uid: UID }, userToken, [200]],
  ["GET", "/api/course-categories", null, adminToken, [200]],
  ["GET", "/api/courses", null, adminToken, [200]],
  ["GET", `/api/courses/${COURSE}`, null, adminToken, [200]],
  ["GET", `/api/courses/mentor/${UID}`, null, mentorToken, [200]],
  ["GET", `/api/lessons/courses/${COURSE}/${UID}`, null, userToken, [200]],
  ["GET", `/api/lessons/detail/${LESSON}`, null, userToken, [200]],
  ["GET", `/api/enrollments/user/${UID}`, null, userToken, [200]],
  ["GET", `/api/enrollments/check/${UID}/${COURSE}`, null, userToken, [200]],
  ["GET", `/api/enrollments/progress?userUid=${UID}&courseId=${COURSE}`, null, userToken, [200]],
  ["GET", `/api/quizzes/getquizbycourse/${COURSE}`, null, mentorToken, [200]],
  ["GET", `/api/quizzes/getquizbycoures/${COURSE}`, null, mentorToken, [200]], // alias cũ
  ["GET", `/api/quizzes/getquizuser/${UID}`, null, userToken, [200]],
  ["GET", `/api/questions/${QUIZ}`, null, mentorToken, [200]],
  ["GET", `/api/quiz-results/users/${UID}/results`, null, userToken, [200]],
  ["GET", "/api/quiz-results/1", null, userToken, [200, 404]], // DB thật chưa có quiz_results
  ["GET", `/api/reviews/course/${COURSE}`, null, userToken, [200]],
  ["GET", `/api/bookmarks/${UID}`, null, userToken, [200]],
  ["POST", "/api/notifications", { uid: UID }, userToken, [200]],
  // 403 (không phải 200): user thật là mentor, role lấy từ DB — xem ghi chú ở đầu file.
  ["GET", "/api/mentor-requests", null, adminToken, [403]],
  ["GET", "/api/users", null, adminToken, [403]],
  ["GET", "/api/users/listmentor", null, adminToken, [200]],
  ["GET", `/api/users/checkactive/${UID}`, null, adminToken, [200]],
  ["GET", `/api/users/${UID}`, null, adminToken, [200]],
  // Kiểm tra chặn IDOR: uid khác trên URL khi token là user thường -> 403
  ["GET", "/api/bookmarks/2f9c1e00-0000-4000-8000-000000000000", null, userToken, [403]],
  // Kiểm tra route param không phải số -> 400, không phải 500
  ["GET", "/api/courses/abc", null, adminToken, [400]],
  ["GET", "/api/lessons/detail/abc", null, userToken, [400]],
  ["GET", "/api/course-categories/abc", null, adminToken, [404, 400]],
  // Không token -> 401
  ["GET", "/api/courses", null, null, [401]],
  // Dev key bypass
  ["GET", "/api/users", null, "DEVKEY", [200]],
];

(async () => {
  let pass = 0, fail = 0;
  for (const chk of checks) {
    const [method, path, body, token, expected] = chk;
    const headers = {};
    if (token === "DEVKEY") headers["x-dev-api-key"] = process.env.DEV_API_KEY;
    else if (token) headers.Authorization = `Bearer ${token}`;
    if (body) headers["Content-Type"] = "application/json";
    let status, text;
    try {
      const res = await fetch(BASE + path, {
        method, headers, body: body ? JSON.stringify(body) : undefined,
      });
      status = res.status;
      text = await res.text();
    } catch (e) {
      status = "ERR";
      text = e.message;
    }
    const ok = expected.includes(status);
    if (ok) pass++; else fail++;
    const mark = ok ? "OK  " : "FAIL";
    console.log(`${mark} ${method.padEnd(5)} ${path.padEnd(58)} -> ${status}`);
    if (!ok) {
      console.log(`        expected ${expected.join("/")}  body: ${text.slice(0, 300)}`);
    }
  }
  console.log(`\n== live probe: ${pass} pass, ${fail} fail ==`);
  process.exit(fail ? 1 : 0);
})();
