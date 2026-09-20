const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createPoolMock,
  loadApp,
  signTestToken,
  withServer,
} = require("../helpers/apiTestUtils");

function authHeaders() {
  return {
    authorization: `Bearer ${signTestToken()}`,
  };
}

test("POST /api/app-stats returns admin dashboard counts", async () => {
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
  });
});

test("GET /api/course-categories returns categories with course counts", async () => {
  const poolMock = createPoolMock([
    {
      rows: [
        {
          category_id: 1,
          name: "JavaScript",
          description: "JS courses",
          course_count: "3",
        },
      ],
    },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ request }) => {
    const response = await request("/api/course-categories", {
      headers: authHeaders(),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.message, "Lấy danh mục cùng số lượng khóa học thành công");
    assert.equal(body.data[0].name, "JavaScript");
  });
});

test("POST /api/bookmarks/create creates bookmark", async () => {
  const poolMock = createPoolMock([
    { rows: [{ course_id: 1 }] }, // kiểm tra khóa học tồn tại
    { rows: [] }, // chưa bookmark
    { rows: [{ bookmark_id: 99 }] }, // INSERT
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/bookmarks/create", {
      method: "POST",
      headers: authHeaders(),
      body: { courseId: 1, userUid: "user-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.data.bookmark_id, 99);
  });
});

test("POST /api/notifications returns notifications for a user", async () => {
  const poolMock = createPoolMock([
    {
      rows: [
        {
          noti_id: 1,
          uid: "user-1",
          title: "Hello",
          content: "World",
          is_read: false,
        },
      ],
    },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/notifications", {
      method: "POST",
      headers: authHeaders(),
      body: { uid: "user-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.notifications[0].title, "Hello");
  });
});
