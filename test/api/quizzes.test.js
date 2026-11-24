const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createPoolMock,
  loadApp,
  signTestToken,
  withServer,
} = require("../helpers/apiTestUtils");

function authHeaders(payload = {}) {
  return {
    authorization: `Bearer ${signTestToken(payload)}`,
  };
}

test("GET /api/quizzes/getquizbycourse/1 (tên đúng chính tả) returns the same result", async () => {
  // "getquizbycoures" là alias tương thích ngược cho FE cũ gọi sai chính tả.
  // Test này khoá lại việc đường dẫn ĐÚNG cũng phải hoạt động, để khi alias bị
  // gỡ ở phiên bản sau thì không âm thầm mất luôn endpoint.
  const poolMock = createPoolMock([
    {
      rows: [
        {
          quiz_id: 1,
          title: "Quiz 1",
          description: null,
          type: "trac_nghiem",
          time_limit: 10,
          attempt_limit: 2,
          creator_uid: "admin-1",
          created_at: new Date("2026-01-01T00:00:00.000Z"),
          updated_at: new Date("2026-01-01T00:00:00.000Z"),
          total_questions: "5",
          average_score: "7.50",
          passing_rate: "80.00",
        },
      ],
    },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ request }) => {
    const response = await request("/api/quizzes/getquizbycourse/1", {
      headers: authHeaders(),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.data[0].title, "Quiz 1");
    assert.equal(poolMock.calls[0].params[0], 1);
  });
});

test("GET /api/quizzes/getquizbycoures/1 returns quizzes with stats", async () => {
  const poolMock = createPoolMock([
    {
      rows: [
        {
          quiz_id: 1,
          title: "Quiz 1",
          description: null,
          type: "trac_nghiem",
          time_limit: 10,
          attempt_limit: 2,
          creator_uid: "admin-1",
          created_at: new Date("2026-01-01T00:00:00.000Z"),
          updated_at: new Date("2026-01-01T00:00:00.000Z"),
          total_questions: "5",
          average_score: "7.50",
          passing_rate: "80.00",
        },
      ],
    },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ request }) => {
    const response = await request("/api/quizzes/getquizbycoures/1", {
      headers: authHeaders(),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.data[0].title, "Quiz 1");
    assert.equal(body.data[0].total_questions, "5");
    assert.equal(body.data[0].average_score, "7.50");
    assert.equal(body.data[0].passing_rate, "80.00");
    assert.match(poolMock.calls[0].sql, /FROM quizzes q/);
    // course_id được ép về số trước khi query
    assert.equal(poolMock.calls[0].params[0], 1);
  });
});

test("GET /api/quizzes/getquizbycoures/1 returns an empty list when the course has no quiz", async () => {
  // Đổi từ 404 sang 200 + mảng rỗng: đây là thay đổi hợp đồng API. "Khoá chưa
  // có bài kiểm tra" là trạng thái bình thường, không phải lỗi — giữ 404 thì FE
  // phải phân biệt hai trường hợp cho cùng một màn hình danh sách.
  const poolMock = createPoolMock([{ rows: [] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ request }) => {
    const response = await request("/api/quizzes/getquizbycoures/1", {
      headers: authHeaders(),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body.data, []);
  });
});

test("POST /api/quizzes/create returns 201", async () => {
  const poolMock = createPoolMock([
    { rows: [{ role: "admin" }] },
    { rows: [{ course_id: 1 }] }, // kiểm tra khóa học tồn tại
    {
      rows: [
        {
          quiz_id: 1,
          course_id: 1,
          title: "Quiz 1",
          type: "trac_nghiem",
          creator_uid: "admin-1",
        },
      ],
    },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/quizzes/create", {
      method: "POST",
      headers: authHeaders({ role: "admin", uid: "admin-1" }),
      body: { course_id: 1, title: "Quiz 1", uid: "admin-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.message, "Tạo bài kiểm tra thành công");
    assert.equal(body.data.quiz_id, 1);
    assert.match(poolMock.calls[0].sql, /SELECT role FROM users/);
    const insert = poolMock.calls.find((c) => /INSERT INTO quizzes/.test(c.sql));
    assert.ok(insert, "phải có truy vấn INSERT");
    assert.equal(insert.params[0], 1);
    assert.equal(insert.params[2], "trac_nghiem");
  });
});

test("POST /api/quizzes/create returns 404 for an unknown course (regression)", async () => {
  // Trước đây thiếu bước kiểm tra này nên course_id không tồn tại sẽ vi phạm
  // khoá ngoại -> 500 kèm tên constraint nội bộ lộ ra client. Phải là 404.
  const poolMock = createPoolMock([
    { rows: [{ role: "admin" }] },
    { rows: [] }, // khóa học không tồn tại
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/quizzes/create", {
      method: "POST",
      headers: authHeaders({ role: "admin", uid: "admin-1" }),
      body: { course_id: 99999, title: "Quiz", uid: "admin-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.error, "Không tìm thấy khóa học");
    assert.ok(!poolMock.calls.some((c) => /INSERT INTO quizzes/i.test(c.sql)));
  });
});

test("POST /api/quizzes/create returns 400 when course_id/title missing", async () => {
  const { app } = loadApp({ poolMock: createPoolMock() });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/quizzes/create", {
      method: "POST",
      headers: authHeaders(),
      body: { uid: "admin-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error, "Thiếu thông tin khóa học hoặc tiêu đề");
  });
});

test("POST /api/quizzes/create returns 403 for role user", async () => {
  const poolMock = createPoolMock([{ rows: [{ role: "user" }] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/quizzes/create", {
      method: "POST",
      headers: authHeaders({ role: "user", uid: "student-1" }),
      body: { course_id: 1, title: "Quiz 1", uid: "student-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 403);
    assert.equal(body.error, "Bạn không có quyền tạo bài kiểm tra");
  });
});

test("PUT /api/quizzes/update/1 returns 200", async () => {
  const poolMock = createPoolMock([
    { rows: [{ role: "admin" }] },
    {
      rows: [
        {
          quiz_id: 1,
          title: "Old title",
          type: "trac_nghiem",
          time_limit: 10,
          attempt_limit: 2,
          creator_uid: "admin-1",
        },
      ],
    },
    {
      rows: [
        {
          quiz_id: 1,
          title: "New title",
          type: "trac_nghiem",
          time_limit: 15,
          attempt_limit: 2,
          creator_uid: "admin-1",
        },
      ],
    },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/quizzes/update/1", {
      method: "PUT",
      headers: authHeaders({ role: "admin", uid: "admin-1" }),
      body: { uid: "admin-1", title: "New title", time_limit: 15 },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.message, "Cập nhật bài kiểm tra thành công");
    assert.equal(body.data.title, "New title");
    assert.match(poolMock.calls[2].sql, /UPDATE quizzes SET/);
    assert.equal(poolMock.calls[2].params[0], "New title");
    assert.equal(poolMock.calls[2].params[1], "trac_nghiem");
    // parsePositiveInt ép quiz_id về SỐ trước khi truyền vào câu SQL.
    assert.equal(poolMock.calls[2].params[4], 1);
  });
});

test("PUT /api/quizzes/update/1 rejects spoofed uid (regression)", async () => {
  const poolMock = createPoolMock();
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/quizzes/update/1", {
      method: "PUT",
      headers: authHeaders({ uid: "student-1", role: "user" }),
      body: { title: "New title", uid: "admin-1" },
    });

    assert.equal(response.status, 403);
    assert.equal(poolMock.calls.length, 0);
  });
});

test("POST /api/quizzes/create rejects an unknown type (regression)", async () => {
  // `type` quyết định cách chấm điểm; giá trị lạ ghi vào DB sẽ làm
  // submitQuizResult rẽ nhánh sai và bài làm kẹt ở "cho_cham".
  const poolMock = createPoolMock([{ rows: [{ role: "admin" }] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/quizzes/create", {
      method: "POST",
      headers: authHeaders({ role: "admin", uid: "admin-1" }),
      body: { course_id: 1, title: "Quiz", type: "khong_ton_tai", uid: "admin-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.match(body.error, /Loại bài kiểm tra không hợp lệ/);
    assert.ok(!poolMock.calls.some((c) => /INSERT INTO quizzes/i.test(c.sql)));
  });
});

test("PUT /api/quizzes/update/1 rejects a non-numeric time_limit (regression)", async () => {
  // Trước đây "abc" đi thẳng vào cột integer → PostgreSQL ném lỗi → 500.
  const poolMock = createPoolMock([
    { rows: [{ role: "admin" }] },
    { rows: [{ quiz_id: 1, title: "Old", type: "trac_nghiem", creator_uid: "admin-1" }] },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/quizzes/update/1", {
      method: "PUT",
      headers: authHeaders({ role: "admin", uid: "admin-1" }),
      body: { uid: "admin-1", time_limit: "abc" },
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.match(body.error, /time_limit phải là số nguyên dương/);
    assert.ok(!poolMock.calls.some((c) => /UPDATE quizzes/i.test(c.sql)));
  });
});

test("PUT /api/quizzes/update/1 rejects an unknown type (regression)", async () => {
  const poolMock = createPoolMock([
    { rows: [{ role: "admin" }] },
    { rows: [{ quiz_id: 1, title: "Old", type: "trac_nghiem", creator_uid: "admin-1" }] },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/quizzes/update/1", {
      method: "PUT",
      headers: authHeaders({ role: "admin", uid: "admin-1" }),
      body: { uid: "admin-1", type: "khong_ton_tai" },
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.match(body.error, /Loại bài kiểm tra không hợp lệ/);
  });
});

test("PUT /api/quizzes/update/1 returns 403 for non-owner non-admin", async () => {
  const poolMock = createPoolMock([
    { rows: [{ role: "user" }] },
    { rows: [{ creator_uid: "other-user" }] },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/quizzes/update/1", {
      method: "PUT",
      headers: authHeaders({ role: "user", uid: "student-1" }),
      body: { uid: "student-1", title: "New title" },
    });
    const body = await response.json();

    assert.equal(response.status, 403);
    assert.equal(body.error, "Bạn không có quyền sửa bài kiểm tra này");
  });
});

test("PUT /api/quizzes/update/1 returns 404 when quiz missing", async () => {
  const poolMock = createPoolMock([{ rows: [{ role: "admin" }] }, { rows: [] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/quizzes/update/1", {
      method: "PUT",
      headers: authHeaders(),
      body: { uid: "admin-1", title: "New title" },
    });
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.error, "Không tìm thấy bài kiểm tra");
  });
});

test("DELETE /api/quizzes/delete/1 cancels the quiz and its children in FK order", async () => {
  const poolMock = createPoolMock([
    { rows: [{ role: "admin" }] },
    { rows: [{ creator_uid: "admin-1" }] },
    { rows: [] },
    { rows: [] },
    { rows: [] },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/quizzes/delete/1", {
      method: "DELETE",
      headers: authHeaders({ role: "admin", uid: "admin-1" }),
      body: { uid: "admin-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.message, "Xoá bài kiểm tra thành công");

    const deleteCalls = poolMock.calls.filter((c) => /^DELETE FROM/i.test(c.sql.trim()));
    assert.equal(deleteCalls.length, 3, "phải xoá quiz_results, quiz_questions, quizzes");
    const order = deleteCalls.map((c) => c.sql.match(/DELETE FROM (\w+)/i)[1].toLowerCase());
    // quiz_questions.quiz_id không có ON DELETE CASCADE trên D1: xoá câu hỏi
    // trước quizzes, nếu không production trả 500.
    assert.deepEqual(order, ["quiz_results", "quiz_questions", "quizzes"]);
  });
});

test("DELETE /api/quizzes/delete/1 rejects spoofed uid (regression)", async () => {
  const poolMock = createPoolMock();
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/quizzes/delete/1", {
      method: "DELETE",
      headers: authHeaders({ uid: "student-1", role: "user" }),
      body: { uid: "admin-1" },
    });

    assert.equal(response.status, 403);
    assert.equal(poolMock.calls.length, 0);
  });
});

test("DELETE /api/quizzes/delete/1 returns 403 for non-owner non-admin", async () => {
  const poolMock = createPoolMock([
    { rows: [{ role: "user" }] },
    { rows: [{ creator_uid: "other-user" }] },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/quizzes/delete/1", {
      method: "DELETE",
      headers: authHeaders({ role: "user", uid: "student-1" }),
      body: { uid: "student-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 403);
    assert.equal(body.error, "Bạn không có quyền xoá bài kiểm tra này");
  });
});

test("DELETE /api/quizzes/delete/1 returns 404 when quiz missing", async () => {
  const poolMock = createPoolMock([{ rows: [{ role: "admin" }] }, { rows: [] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/quizzes/delete/1", {
      method: "DELETE",
      headers: authHeaders(),
      body: { uid: "admin-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.error, "Không tìm thấy bài kiểm tra");
  });
});

test("GET /api/quizzes/getquizuser/user-1 returns enrolled and not-enrolled courses", async () => {
  const poolMock = createPoolMock([
    { rows: [{ course_id: 1 }] },
    { rows: [{ course_id: 2 }] },
    {
      rows: [
        {
          quiz_id: 10,
          course_id: 1,
          title: "Enrolled quiz",
          course_title: "Course 1",
          type: "trac_nghiem",
        },
      ],
    },
    {
      rows: [
        {
          quiz_id: 20,
          course_id: 2,
          title: "Not enrolled quiz",
          course_title: "Course 2",
          type: "trac_nghiem",
        },
      ],
    },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ request }) => {
    const response = await request("/api/quizzes/getquizuser/user-1", {
      headers: authHeaders(),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.ok(Array.isArray(body.data.enrolledCourses));
    assert.ok(Array.isArray(body.data.notEnrolledCourses));
    assert.equal(body.data.enrolledCourses.length, 1);
    assert.equal(body.data.enrolledCourses[0].course_id, 1);
    assert.equal(body.data.enrolledCourses[0].quizzes[0].title, "Enrolled quiz");
    assert.equal(body.data.notEnrolledCourses.length, 1);
    assert.equal(body.data.notEnrolledCourses[0].course_id, 2);
    assert.equal(
      body.data.notEnrolledCourses[0].quizzes[0].title,
      "Not enrolled quiz"
    );
    assert.match(poolMock.calls[0].sql, /FROM enrollments e/);
    assert.match(poolMock.calls[1].sql, /NOT IN/);
    assert.match(poolMock.calls[2].sql, /FROM quizzes q/);
    assert.match(poolMock.calls[3].sql, /FROM quizzes q/);
  });
});

test("GET /api/quizzes/getquizuser/ (empty user_uid) - 400 branch unreachable", async () => {
  // Express 5 requires a non-empty :user_uid segment, so the controller's
  // `if (!user_uid) return 400` branch can never fire over HTTP. The request
  // falls through to the framework's 404 handler instead.
  const { app } = loadApp({ poolMock: createPoolMock() });

  await withServer(app, async ({ request }) => {
    const response = await request("/api/quizzes/getquizuser/", {
      headers: authHeaders(),
    });

    assert.equal(response.status, 404);
  });
});
