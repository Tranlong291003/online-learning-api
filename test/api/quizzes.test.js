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
    assert.equal(poolMock.calls[0].params[0], "1");
  });
});

test("GET /api/quizzes/getquizbycoures/1 returns 404 when no quizzes", async () => {
  const poolMock = createPoolMock([{ rows: [] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ request }) => {
    const response = await request("/api/quizzes/getquizbycoures/1", {
      headers: authHeaders(),
    });
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.error, "Không tìm thấy bài kiểm tra cho khóa học này");
  });
});

test("POST /api/quizzes/create returns 201", async () => {
  const poolMock = createPoolMock([
    { rows: [{ role: "admin" }] },
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
    assert.match(poolMock.calls[1].sql, /INSERT INTO quizzes/);
    assert.equal(poolMock.calls[1].params[0], 1);
    assert.equal(poolMock.calls[1].params[2], "trac_nghiem");
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
    assert.equal(poolMock.calls[2].params[4], "1");
  });
});

test("PUT /api/quizzes/update/1 returns 400 when uid missing", async () => {
  const { app } = loadApp({ poolMock: createPoolMock() });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/quizzes/update/1", {
      method: "PUT",
      headers: authHeaders(),
      body: { title: "New title" },
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error, "Thiếu UID người dùng");
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

test("DELETE /api/quizzes/delete/1 returns 200 and deletes quiz_results BEFORE quizzes", async () => {
  const poolMock = createPoolMock([
    { rows: [{ role: "admin" }] },
    { rows: [{ creator_uid: "admin-1" }] },
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
    assert.equal(poolMock.calls.length, 4);
    const resultsDelete = poolMock.calls.findIndex((c) =>
      c.sql.includes("DELETE FROM quiz_results")
    );
    const quizzesDelete = poolMock.calls.findIndex((c) =>
      c.sql.includes("DELETE FROM quizzes")
    );
    assert.notEqual(resultsDelete, -1, "expected DELETE FROM quiz_results query");
    assert.notEqual(quizzesDelete, -1, "expected DELETE FROM quizzes query");
    assert.ok(
      resultsDelete < quizzesDelete,
      "quiz_results must be deleted before quizzes"
    );
  });
});

test("DELETE /api/quizzes/delete/1 returns 400 when uid missing", async () => {
  const { app } = loadApp({ poolMock: createPoolMock() });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/quizzes/delete/1", {
      method: "DELETE",
      headers: authHeaders(),
      body: {},
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error, "Thiếu UID người dùng");
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
