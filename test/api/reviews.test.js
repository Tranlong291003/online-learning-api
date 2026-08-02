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

test("POST /api/reviews/create returns 201 with review_id", async () => {
  const bySql = (sql) =>
    sql.includes("SELECT 1 FROM course_reviews")
      ? { rows: [] }
      : { rows: [{ review_id: 42 }] };
  const poolMock = createPoolMock([bySql, bySql]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/reviews/create", {
      method: "POST",
      headers: authHeaders(),
      body: { course_id: 1, user_uid: "user-1", rating: 5, comment: "Great" },
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.data.review_id, 42);
    assert.equal(poolMock.calls.length, 2);
    assert.deepEqual(poolMock.calls[1].params, [1, "user-1", 5, "Great"]);
    assert.ok(poolMock.calls[1].sql.includes("INSERT INTO course_reviews"));
  });
});

test("POST /api/reviews/create returns 400 when required fields are missing", async () => {
  const poolMock = createPoolMock();
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/reviews/create", {
      method: "POST",
      headers: authHeaders(),
      body: { user_uid: "user-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.match(body.error, /course_id, user_uid và rating/);
    assert.equal(poolMock.calls.length, 0);
  });
});

test("POST /api/reviews/create returns 400 when user already reviewed", async () => {
  const poolMock = createPoolMock([
    (sql) => (sql.includes("SELECT 1 FROM course_reviews") ? { rows: [{ 1: 1 }] } : null),
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/reviews/create", {
      method: "POST",
      headers: authHeaders(),
      body: { course_id: 1, user_uid: "user-1", rating: 4 },
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.match(body.error, /đã review/);
    assert.equal(poolMock.calls.length, 1);
  });
});

test("GET /api/reviews/course/1 returns 200 with review list", async () => {
  const poolMock = createPoolMock([
    {
      rows: [
        {
          review_id: 1,
          course_id: 1,
          user_uid: "user-1",
          user_name: "User One",
          rating: 5,
          comment: "Nice",
        },
      ],
    },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ request }) => {
    const response = await request("/api/reviews/course/1", {
      headers: authHeaders(),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].user_name, "User One");
    assert.deepEqual(poolMock.calls[0].params, ["1"]);
  });
});

test("GET /api/reviews/course/1 returns 500 on database error", async () => {
  const poolMock = createPoolMock([
    () => {
      throw new Error("db down");
    },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ request }) => {
    const response = await request("/api/reviews/course/1", {
      headers: authHeaders(),
    });
    const body = await response.json();

    assert.equal(response.status, 500);
    assert.match(body.error, /db down/);
  });
});

test("PUT /api/reviews/update/1 returns 200 and updates rating", async () => {
  const poolMock = createPoolMock([
    (sql) =>
      sql.includes("SELECT user_uid FROM course_reviews")
        ? { rows: [{ user_uid: "user-1" }] }
        : { rows: [] },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/reviews/update/1", {
      method: "PUT",
      headers: authHeaders(),
      body: { user_uid: "user-1", rating: 4 },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.match(body.message, /Cập nhật thành công/);
    assert.equal(poolMock.calls.length, 2);
    assert.ok(poolMock.calls[1].sql.includes("UPDATE course_reviews SET"));
    assert.deepEqual(poolMock.calls[1].params, [4, "1"]);
  });
});

test("PUT /api/reviews/update/1 returns 400 when user_uid missing", async () => {
  const poolMock = createPoolMock();
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/reviews/update/1", {
      method: "PUT",
      headers: authHeaders(),
      body: { rating: 4 },
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.match(body.error, /user_uid/);
    assert.equal(poolMock.calls.length, 0);
  });
});

test("PUT /api/reviews/update/1 returns 400 when no fields to update", async () => {
  const poolMock = createPoolMock();
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/reviews/update/1", {
      method: "PUT",
      headers: authHeaders(),
      body: { user_uid: "user-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.match(body.error, /Không có dữ liệu để cập nhật/);
    assert.equal(poolMock.calls.length, 0);
  });
});

test("PUT /api/reviews/update/1 returns 403 when review belongs to another user", async () => {
  const poolMock = createPoolMock([
    { rows: [{ user_uid: "someone-else" }] },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/reviews/update/1", {
      method: "PUT",
      headers: authHeaders(),
      body: { user_uid: "user-1", rating: 3 },
    });
    const body = await response.json();

    assert.equal(response.status, 403);
    assert.match(body.error, /không có quyền cập nhật/);
    assert.equal(poolMock.calls.length, 1);
  });
});

test("PUT /api/reviews/update/1 returns 404 when review not found", async () => {
  const poolMock = createPoolMock([{ rows: [] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/reviews/update/1", {
      method: "PUT",
      headers: authHeaders(),
      body: { user_uid: "user-1", rating: 3 },
    });
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.match(body.error, /Không tìm thấy review/);
  });
});

test("DELETE /api/reviews/delete/1 returns 200 when owner deletes", async () => {
  const poolMock = createPoolMock([
    (sql) =>
      sql.includes("SELECT user_uid FROM course_reviews")
        ? { rows: [{ user_uid: "user-1" }] }
        : { rows: [] },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/reviews/delete/1", {
      method: "DELETE",
      headers: authHeaders(),
      body: { user_uid: "user-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.match(body.message, /Xóa thành công/);
    assert.ok(poolMock.calls[1].sql.includes("DELETE FROM course_reviews"));
    assert.deepEqual(poolMock.calls[1].params, ["1"]);
  });
});

test("DELETE /api/reviews/delete/1 returns 400 when user_uid missing", async () => {
  const poolMock = createPoolMock();
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/reviews/delete/1", {
      method: "DELETE",
      headers: authHeaders(),
      body: {},
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.match(body.error, /user_uid/);
    assert.equal(poolMock.calls.length, 0);
  });
});

test("DELETE /api/reviews/delete/1 returns 403 when review belongs to another user", async () => {
  const poolMock = createPoolMock([
    { rows: [{ user_uid: "someone-else" }] },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/reviews/delete/1", {
      method: "DELETE",
      headers: authHeaders(),
      body: { user_uid: "user-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 403);
    assert.match(body.error, /không có quyền xóa/);
  });
});

test("DELETE /api/reviews/delete/1 returns 404 when review not found", async () => {
  const poolMock = createPoolMock([{ rows: [] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/reviews/delete/1", {
      method: "DELETE",
      headers: authHeaders(),
      body: { user_uid: "user-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.match(body.error, /Không tìm thấy review/);
  });
});
