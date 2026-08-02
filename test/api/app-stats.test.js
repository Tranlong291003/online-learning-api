const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createPoolMock,
  loadApp,
  signTestToken,
  withServer,
} = require("../helpers/apiTestUtils");

function authHeaders(payload) {
  return {
    authorization: `Bearer ${signTestToken(payload)}`,
  };
}

test("POST /api/app-stats returns 401 without an auth header", async () => {
  const poolMock = createPoolMock([]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/app-stats", {
      method: "POST",
      body: { uid: "admin-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.ok(body.error);
    assert.equal(poolMock.calls.length, 0);
  });
});

test("POST /api/app-stats returns admin dashboard stats", async () => {
  const poolMock = createPoolMock([
    { rows: [{ role: "admin" }] },
    {
      rows: [
        {
          total_courses: "10",
          total_users: "20",
          total_quizzes: "5",
          total_reviews: "8",
        },
      ],
    },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/app-stats", {
      method: "POST",
      headers: authHeaders(),
      body: { uid: "admin-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.role, "admin");
    assert.equal(body.total_courses, "10");
    assert.equal(body.total_users, "20");
    assert.equal(body.total_quizzes, "5");
    assert.equal(body.total_reviews, "8");
  });
});

test("POST /api/app-stats returns mentor stats", async () => {
  const poolMock = createPoolMock([
    { rows: [{ role: "mentor" }] },
    {
      rows: [
        {
          total_courses: "3",
          total_students: "12",
          total_lessons: "9",
          avg_rating: "4.5",
        },
      ],
    },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/app-stats", {
      method: "POST",
      headers: authHeaders(),
      body: { uid: "mentor-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.role, "mentor");
    assert.equal(body.total_courses, "3");
    assert.equal(body.total_students, "12");
    assert.equal(body.total_lessons, "9");
    assert.equal(body.avg_rating, "4.5");

    assert.ok(poolMock.calls[1].params.includes("mentor-1"));
  });
});

test("POST /api/app-stats returns 403 for a regular user", async () => {
  const poolMock = createPoolMock([{ rows: [{ role: "user" }] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/app-stats", {
      method: "POST",
      headers: authHeaders(),
      body: { uid: "student-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 403);
    assert.equal(body.error, "Bạn không có quyền xem thống kê này");
    assert.equal(poolMock.calls.length, 1);
  });
});

test("POST /api/app-stats returns 400 when uid is missing", async () => {
  const poolMock = createPoolMock([]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/app-stats", {
      method: "POST",
      headers: authHeaders(),
      body: {},
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error, "Thiếu uid");
    assert.equal(poolMock.calls.length, 0);
  });
});

test("POST /api/app-stats returns 404 when user is not found", async () => {
  const poolMock = createPoolMock([{ rows: [] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/app-stats", {
      method: "POST",
      headers: authHeaders(),
      body: { uid: "ghost-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.error, "Không tìm thấy user");
  });
});
