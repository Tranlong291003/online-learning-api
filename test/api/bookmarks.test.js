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

test("GET /api/bookmarks/user-1 returns 200 with bookmark list", async () => {
  const poolMock = createPoolMock([
    {
      rows: [
        {
          bookmark_id: 5,
          course_id: 2,
          course_title: "Express Basics",
          course_thumbnail: "thumb.png",
          created_at: "2026-01-01",
        },
      ],
    },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ request }) => {
    const response = await request("/api/bookmarks/user-1", {
      headers: authHeaders(),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].course_title, "Express Basics");
    assert.deepEqual(poolMock.calls[0].params, ["user-1"]);
    assert.ok(poolMock.calls[0].sql.includes("FROM bookmarks b"));
  });
});

test("GET /api/bookmarks/ with missing user_uid is not routable", async () => {
  const poolMock = createPoolMock();
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ request }) => {
    const response = await request("/api/bookmarks/", {
      headers: authHeaders(),
    });

    assert.equal(response.status, 404);
    assert.equal(poolMock.calls.length, 0);
  });
});

test("POST /api/bookmarks/create returns 201 with bookmark_id", async () => {
  const bySql = (sql) =>
    sql.includes("SELECT 1 FROM bookmarks")
      ? { rows: [] }
      : { rows: [{ bookmark_id: 9 }] };
  const poolMock = createPoolMock([bySql, bySql]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/bookmarks/create", {
      method: "POST",
      headers: authHeaders(),
      body: { courseId: 3, userUid: "user-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.data.bookmark_id, 9);
    assert.equal(poolMock.calls.length, 2);
    assert.deepEqual(poolMock.calls[1].params, [3, "user-1"]);
    assert.ok(poolMock.calls[1].sql.includes("INSERT INTO bookmarks"));
  });
});

test("POST /api/bookmarks/create returns 400 when courseId missing", async () => {
  const poolMock = createPoolMock();
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/bookmarks/create", {
      method: "POST",
      headers: authHeaders(),
      body: { userUid: "user-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.match(body.error, /courseId/);
    assert.equal(poolMock.calls.length, 0);
  });
});

test("POST /api/bookmarks/create ignores a spoofed userUid for a non-admin", async () => {
  const poolMock = createPoolMock();
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/bookmarks/create", {
      method: "POST",
      headers: authHeaders({ uid: "user-1", role: "user" }),
      body: { courseId: 3, userUid: "victim-2" },
    });

    assert.equal(response.status, 403);
    assert.equal(poolMock.calls.length, 0);
  });
});

test("POST /api/bookmarks/create returns 400 when already bookmarked", async () => {
  const poolMock = createPoolMock([
    (sql) => (sql.includes("SELECT 1 FROM bookmarks") ? { rows: [{ 1: 1 }] } : null),
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/bookmarks/create", {
      method: "POST",
      headers: authHeaders(),
      body: { courseId: 3, userUid: "user-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.match(body.error, /đã bookmark/);
    assert.equal(poolMock.calls.length, 1);
  });
});

test("DELETE /api/bookmarks/delete returns 200 when owner deletes", async () => {
  const poolMock = createPoolMock([
    (sql) =>
      sql.includes("SELECT user_uid FROM bookmarks")
        ? { rows: [{ user_uid: "user-1" }] }
        : { rows: [] },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/bookmarks/delete", {
      method: "DELETE",
      headers: authHeaders(),
      body: { bookmarkId: 5, userUid: "user-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.data, null);
    assert.ok(poolMock.calls[1].sql.includes("DELETE FROM bookmarks"));
    assert.deepEqual(poolMock.calls[1].params, [5]);
  });
});

test("DELETE /api/bookmarks/delete returns 400 when bookmarkId missing", async () => {
  const poolMock = createPoolMock();
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/bookmarks/delete", {
      method: "DELETE",
      headers: authHeaders(),
      body: { userUid: "user-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.match(body.error, /bookmarkId/);
    assert.equal(poolMock.calls.length, 0);
  });
});

test("DELETE /api/bookmarks/delete ignores a spoofed userUid for a non-admin", async () => {
  const poolMock = createPoolMock();
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/bookmarks/delete", {
      method: "DELETE",
      headers: authHeaders({ uid: "user-1", role: "user" }),
      body: { bookmarkId: 5, userUid: "victim-2" },
    });

    assert.equal(response.status, 403);
    assert.equal(poolMock.calls.length, 0);
  });
});

test("DELETE /api/bookmarks/delete returns 403 when bookmark belongs to another user", async () => {
  const poolMock = createPoolMock([
    { rows: [{ user_uid: "someone-else" }] },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/bookmarks/delete", {
      method: "DELETE",
      headers: authHeaders(),
      body: { bookmarkId: 5, userUid: "user-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 403);
    assert.match(body.error, /không có quyền xóa bookmark/);
  });
});

test("DELETE /api/bookmarks/delete returns 404 when bookmark not found", async () => {
  const poolMock = createPoolMock([{ rows: [] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/bookmarks/delete", {
      method: "DELETE",
      headers: authHeaders(),
      body: { bookmarkId: 999, userUid: "user-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.match(body.error, /Không tìm thấy bookmark/);
  });
});
