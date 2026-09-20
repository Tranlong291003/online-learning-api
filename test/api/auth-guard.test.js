const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const { loadApp, signTestToken, testUserRegistry, withServer } = require("../helpers/apiTestUtils");

const protectedEndpoints = [
  ["GET", "/api/bookmarks/user-1"],
  ["POST", "/api/bookmarks/create"],
  ["DELETE", "/api/bookmarks/delete"],
  ["GET", "/api/course-categories"],
  ["POST", "/api/course-categories/create"],
  ["PUT", "/api/course-categories/update/1"],
  ["DELETE", "/api/course-categories/delete/1"],
  ["GET", "/api/courses"],
  ["GET", "/api/courses/mentor/mentor-1"],
  ["GET", "/api/courses/1"],
  ["POST", "/api/courses/create"],
  ["PUT", "/api/courses/update/1"],
  ["PATCH", "/api/courses/1/status"],
  ["DELETE", "/api/courses/delete/1"],
  ["POST", "/api/enrollments/register"],
  ["GET", "/api/enrollments/user/user-1"],
  ["DELETE", "/api/enrollments/delete/1"],
  ["GET", "/api/enrollments/progress"],
  ["GET", "/api/enrollments/check/user-1/1"],
  ["GET", "/api/lessons/courses/1/user-1"],
  ["POST", "/api/lessons/create"],
  ["PUT", "/api/lessons/update/1"],
  ["DELETE", "/api/lessons/delete/1"],
  ["POST", "/api/lessons/complete"],
  ["GET", "/api/lessons/detail/1"],
  ["GET", "/api/mentor-requests"],
  ["POST", "/api/mentor-requests"],
  ["PUT", "/api/mentor-requests/1/status"],
  ["POST", "/api/notifications"],
  ["POST", "/api/notifications/create"],
  ["POST", "/api/notifications/mark-read"],
  ["DELETE", "/api/notifications/delete/1"],
  ["GET", "/api/questions/1"],
  ["POST", "/api/questions/createbyuser"],
  ["POST", "/api/questions/createbyai"],
  ["PUT", "/api/questions/update/1"],
  ["DELETE", "/api/questions/delete/1"],
  ["POST", "/api/quiz-results/submit"],
  ["GET", "/api/quiz-results/users/user-1/results"],
  ["GET", "/api/quiz-results/1"],
  ["PATCH", "/api/quiz-results/quiz-results/1/grade"],
  ["GET", "/api/quizzes/getquizbycourse/1"],
  ["GET", "/api/quizzes/getquizuser/user-1"],
  ["POST", "/api/quizzes/create"],
  ["PUT", "/api/quizzes/update/1"],
  ["DELETE", "/api/quizzes/delete/1"],
  ["GET", "/api/reviews/course/1"],
  ["POST", "/api/reviews/create"],
  ["PUT", "/api/reviews/update/1"],
  ["DELETE", "/api/reviews/delete/1"],
  ["GET", "/api/users"],
  ["GET", "/api/users/listmentor"],
  ["GET", "/api/users/checkactive/user-1"],
  ["GET", "/api/users/user-1"],
  ["PATCH", "/api/users/user-1/status"],
  ["DELETE", "/api/users/delete/user-1"],
  ["PUT", "/api/users/update/user-1"],
  ["PUT", "/api/users/updaterole"],
];

test("protected API routes reject requests without Bearer token", async () => {
  const { app } = loadApp();

  await withServer(app, async ({ request }) => {
    for (const [method, url] of protectedEndpoints) {
      const response = await request(url, { method });
      const body = await response.json();

      assert.equal(response.status, 401, `${method} ${url}`);
      assert.equal(body.error, "Token không hợp lệ", `${method} ${url}`);
    }
  });
});

// ---------- Hồi quy: token cũ không được giữ quyền đã bị thu hồi ----------
// Trước đây middleware chỉ verify chữ ký JWT rồi tin `role` trong token. Hệ quả:
//  - admin bị hạ quyền trong DB vẫn giữ quyền admin tới khi token hết hạn (7 ngày)
//  - tài khoản bị khoá (is_active = false) vẫn gọi được API
//  - token ký cho uid không tồn tại vẫn qua được mọi endpoint chỉ đọc req.user.role
// Ba test dưới đây khoá lại hành vi đúng: role/is_active lấy từ DB.

test("token khai role admin nhưng uid không tồn tại trong DB bị chặn 401", async () => {
  const { app, poolMock } = loadApp();

  await withServer(app, async ({ request }) => {
    // Ký token hợp lệ (đúng chữ ký, đúng issuer/audience) nhưng uid chưa từng
    // được đăng ký trong sổ user test.
    const ghostToken = jwt.sign(
      { uid: "ghost-khong-ton-tai", email: "ghost@test.local", role: "admin", type: "access" },
      process.env.JWT_SECRET,
      {
        expiresIn: "1h",
        issuer: process.env.JWT_ISSUER || "online-learning-api",
        audience: process.env.JWT_AUDIENCE || "online-learning-client",
        algorithm: "HS256",
      }
    );

    const response = await request("/api/users", {
      headers: { authorization: `Bearer ${ghostToken}` },
    });
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.error, "Tài khoản không tồn tại");
    // Không được chạm DB để trả danh sách
    assert.equal(poolMock.calls.length, 0);
  });
});

test("tài khoản bị khoá (is_active=false) bị chặn 403 dù token còn hạn", async () => {
  const { app, poolMock } = loadApp();
  const token = signTestToken({ uid: "banned-user", role: "user" });
  // Token đã được đăng ký với is_active = true; giả lập admin vừa khoá tài khoản.
  testUserRegistry.set("banned-user", { role: "user", is_active: false });

  await withServer(app, async ({ request }) => {
    const response = await request("/api/courses", {
      headers: { authorization: `Bearer ${token}` },
    });
    const body = await response.json();

    assert.equal(response.status, 403);
    assert.equal(body.error, "Tài khoản đã bị khoá");
    assert.equal(poolMock.calls.length, 0);
  });
});

test("role lấy từ DB, không lấy từ token: token khai admin nhưng DB là user vẫn bị 403", async () => {
  const { app } = loadApp();
  // Token khai admin, nhưng sổ user test ghi role thật là "user".
  const token = signTestToken({ uid: "demoted-admin", role: "admin" });
  testUserRegistry.set("demoted-admin", { role: "user", is_active: true });

  await withServer(app, async ({ request }) => {
    const response = await request("/api/users", {
      headers: { authorization: `Bearer ${token}` },
    });
    const body = await response.json();

    assert.equal(response.status, 403, "quyền admin đã bị thu hồi thì token cũ không được qua");
    assert.equal(body.error, "Bạn không có quyền xem danh sách người dùng");
  });
});
