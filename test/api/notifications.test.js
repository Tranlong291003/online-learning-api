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

test("POST /api/notifications returns 200 with notifications", async () => {
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
    assert.equal(body.notifications.length, 1);
    assert.equal(body.notifications[0].title, "Hello");
    assert.deepEqual(poolMock.calls[0].params, ["user-1"]);
    assert.ok(poolMock.calls[0].sql.includes("FROM notifications"));
  });
});

test("POST /api/notifications returns 200 with empty list when no rows", async () => {
  const poolMock = createPoolMock([{ rows: [] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/notifications", {
      method: "POST",
      headers: authHeaders(),
      body: { uid: "user-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body.notifications, []);
  });
});

test("POST /api/notifications uses token uid when body omits it (regression)", async () => {
  const poolMock = createPoolMock([{ rows: [] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/notifications", {
      method: "POST",
      headers: authHeaders({ uid: "user-1", role: "user" }),
      body: {},
    });

    assert.equal(response.status, 200);
    const call = poolMock.calls.find((c) =>
      c.sql.toLowerCase().includes("from notifications")
    );
    assert.ok(call, "phải truy vấn notifications bằng uid lấy từ token");
    assert.equal(call.params[0], "user-1");
  });
});

test("POST /api/notifications rejects spoofed uid (regression)", async () => {
  const poolMock = createPoolMock();
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/notifications", {
      method: "POST",
      headers: authHeaders({ uid: "student-1", role: "user" }),
      body: { uid: "admin-1" },
    });

    assert.equal(response.status, 403);
    assert.equal(poolMock.calls.length, 0);
  });
});

test("POST /api/notifications/create returns 201 with created notification", async () => {
  const poolMock = createPoolMock([
    {
      rows: [
        {
          noti_id: 7,
          uid: "user-1",
          title: "New lesson",
          content: "Lesson 3 ready",
          icon: "book",
          color: "blue",
          is_read: false,
        },
      ],
    },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/notifications/create", {
      method: "POST",
      headers: authHeaders(),
      body: {
        uid: "user-1",
        title: "New lesson",
        content: "Lesson 3 ready",
        icon: "book",
        color: "blue",
      },
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.noti_id, 7);
    assert.ok(poolMock.calls[0].sql.includes("INSERT INTO notifications"));
    assert.deepEqual(poolMock.calls[0].params, [
      "user-1",
      "New lesson",
      "Lesson 3 ready",
      "book",
      "blue",
    ]);
  });
});

test("POST /api/notifications/create returns 400 when title/content missing", async () => {
  const poolMock = createPoolMock();
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/notifications/create", {
      method: "POST",
      headers: authHeaders(),
      body: { title: "No content" },
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.match(body.error, /Thiếu title hoặc content/);
    assert.equal(poolMock.calls.length, 0);
  });
});

test("POST /api/notifications/mark-read returns 200", async () => {
  const poolMock = createPoolMock([{ rows: [{ noti_id: 1 }] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/notifications/mark-read", {
      method: "POST",
      headers: authHeaders(),
      body: { uid: "user-1", noti_id: 1 },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.match(body.message, /đã đọc/);
    assert.deepEqual(poolMock.calls[0].params, [1, "user-1"]);
    assert.ok(poolMock.calls[0].sql.includes("UPDATE notifications"));
  });
});

test("POST /api/notifications/mark-read returns 400 when noti_id missing", async () => {
  const poolMock = createPoolMock();
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/notifications/mark-read", {
      method: "POST",
      headers: authHeaders(),
      body: {},
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.match(body.error, /Thiếu noti_id/);
    assert.equal(poolMock.calls.length, 0);
  });
});

test("POST /api/notifications/mark-read returns 404 when notification not found", async () => {
  const poolMock = createPoolMock([{ rows: [] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/notifications/mark-read", {
      method: "POST",
      headers: authHeaders(),
      body: { uid: "user-1", noti_id: 999 },
    });
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.match(body.message, /Không tìm thấy thông báo/);
  });
});

test("DELETE /api/notifications/delete/1 returns 200", async () => {
  const poolMock = createPoolMock([{ rows: [{ noti_id: 1 }] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/notifications/delete/1", {
      method: "DELETE",
      headers: authHeaders(),
      body: { uid: "user-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.match(body.message, /đã bị xóa/);
    // noti_id là UUID trong DB thật — giữ nguyên chuỗi, không ép về số
    assert.deepEqual(poolMock.calls[0].params, ["1", "user-1"]);
    assert.ok(poolMock.calls[0].sql.includes("DELETE FROM notifications"));
  });
});

test("DELETE /api/notifications/delete/1 rejects spoofed uid (regression)", async () => {
  const poolMock = createPoolMock();
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/notifications/delete/1", {
      method: "DELETE",
      headers: authHeaders({ uid: "student-1", role: "user" }),
      body: { uid: "admin-1" },
    });

    assert.equal(response.status, 403);
    assert.equal(poolMock.calls.length, 0);
  });
});

test("DELETE /api/notifications/delete/1 returns 404 when notification not found", async () => {
  const poolMock = createPoolMock([{ rows: [] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/notifications/delete/1", {
      method: "DELETE",
      headers: authHeaders(),
      body: { uid: "user-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.match(body.message, /Không tìm thấy thông báo/);
  });
});
