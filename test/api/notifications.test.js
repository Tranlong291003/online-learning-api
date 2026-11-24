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

test("POST /api/notifications/create accepts a body without icon/color (regression)", async () => {
  // Trên D1, bind giá trị `undefined` ném "D1_TYPE_ERROR: Type 'undefined' not
  // supported" → endpoint trả 500 dù request hoàn toàn hợp lệ (icon/color là
  // tuỳ chọn). Trước đây controller chuyển thẳng `icon`, `color` từ body.
  const poolMock = createPoolMock([{ rows: [{ noti_id: "n-1" }] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/notifications/create", {
      method: "POST",
      headers: authHeaders(),
      body: { uid: "user-1", title: "T", content: "C" },
    });

    assert.equal(response.status, 201);
    const call = poolMock.calls.find((c) => /INSERT INTO notifications/i.test(c.sql));
    assert.ok(call);
    // Không được có `undefined` trong tham số bind.
    assert.ok(
      call.params.every((p) => p !== undefined),
      "không được bind undefined"
    );
    assert.equal(call.params[3], null, "icon phải là null");
    assert.equal(call.params[4], null, "color phải là null");
  });
});

test("readFile trả nội dung dạng byte cho cả Blob (D1) và Buffer (PostgreSQL)", async () => {
  // Trên D1, cột BLOB được trả về dưới dạng `Blob` — có `.size` nhưng KHÔNG có
  // `.length`. Trước đây `readFile` trả nguyên giá trị này, nên `app.js` đặt
  // Content-Length = undefined và `res.end(blob)` ném lỗi: mọi file upload trả
  // 500 trên production dù đã lưu đúng trong CSDL.
  const payload = Buffer.from("noi-dung-file", "utf8");
  const blobMock = {
    size: payload.length,
    arrayBuffer: async () =>
      payload.buffer.slice(payload.byteOffset, payload.byteOffset + payload.byteLength),
  };

  const poolMock = createPoolMock([
    { rows: [{ mime_type: "image/png", size_bytes: payload.length, content: blobMock }] },
    { rows: [{ mime_type: "image/png", size_bytes: payload.length, content: payload }] },
  ]);
  // loadApp mock db.config, nên require fileStorage SAU đó sẽ dùng pool giả.
  loadApp({ poolMock });
  const { readFile } = require("../../src/services/fileStorage");

  const fromBlob = await readFile("/uploads/avatars/a.png");
  assert.ok(fromBlob, "phải trả bản ghi");
  assert.equal(fromBlob.content.length, payload.length, "Blob phải được đổi thành byte");
  assert.equal(Buffer.from(fromBlob.content).toString("utf8"), "noi-dung-file");

  // PostgreSQL trả Buffer — đường này cũng phải cho cùng kết quả.
  const fromBuffer = await readFile("/uploads/avatars/a.png");
  assert.equal(fromBuffer.content.length, payload.length);
  assert.equal(Buffer.from(fromBuffer.content).toString("utf8"), "noi-dung-file");
});

test("POST /api/notifications/mark-read returns 200", async () => {
  // noti_id là UUID trong CSDL, controller validate định dạng trước khi truy vấn.
  const NOTI_ID = "11111111-2222-3333-4444-555555555555";
  const poolMock = createPoolMock([{ rows: [{ noti_id: NOTI_ID }] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/notifications/mark-read", {
      method: "POST",
      headers: authHeaders(),
      body: { uid: "user-1", noti_id: NOTI_ID },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.match(body.message, /đã đọc/);
    assert.deepEqual(poolMock.calls[0].params, [NOTI_ID, "user-1"]);
    assert.ok(poolMock.calls[0].sql.includes("UPDATE notifications"));
  });
});

test("POST /api/notifications/mark-read returns 400 for malformed noti_id (regression)", async () => {
  // Trước đây giá trị không phải UUID đi thẳng vào câu SQL, PostgreSQL ném
  // "invalid input syntax for type uuid" và API trả 500.
  const poolMock = createPoolMock();
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/notifications/mark-read", {
      method: "POST",
      headers: authHeaders(),
      body: { uid: "user-1", noti_id: "1" },
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.match(body.error, /noti_id không hợp lệ/);
    assert.equal(poolMock.calls.length, 0);
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
      body: { uid: "user-1", noti_id: "99999999-8888-7777-6666-555555555555" },
    });
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.match(body.message, /Không tìm thấy thông báo/);
  });
});

// ---------- PUT /api/notifications/update/:id ----------
// Biến thể đánh dấu đã đọc nhưng nhận noti_id trên URL (endpoint cũ dùng body).

test("PUT /api/notifications/update/:id marks a notification as read", async () => {
  const poolMock = createPoolMock([{ rows: [{ noti_id: "noti-uuid-1" }] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/notifications/update/11111111-1111-1111-1111-111111111111", {
      method: "PUT",
      headers: authHeaders({ uid: "user-1", role: "user" }),
      body: {},
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.match(body.message, /đã đọc/);

    // noti_id là UUID -> phải truyền nguyên chuỗi vào SQL, không ép về số.
    assert.deepEqual(poolMock.calls[0].params, ["11111111-1111-1111-1111-111111111111", "user-1"]);
    assert.ok(poolMock.calls[0].sql.includes("UPDATE notifications"));
    // Chỉ được sửa thông báo của chính người gọi (uid lấy từ token).
    assert.ok(poolMock.calls[0].sql.includes("uid = $2"));
  });
});

test("PUT /api/notifications/update/:id returns 404 when the notification is not the caller's", async () => {
  // UPDATE có điều kiện `AND uid = $2` -> thông báo của người khác không khớp.
  const poolMock = createPoolMock([{ rows: [] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/notifications/update/11111111-1111-1111-1111-111111111111", {
      method: "PUT",
      headers: authHeaders(),
      body: {},
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
    const response = await json("/api/notifications/delete/11111111-1111-1111-1111-111111111111", {
      method: "DELETE",
      headers: authHeaders(),
      body: { uid: "user-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.match(body.message, /đã bị xóa/);
    // noti_id là UUID trong DB thật — giữ nguyên chuỗi, không ép về số
    assert.deepEqual(poolMock.calls[0].params, [
      "11111111-1111-1111-1111-111111111111",
      "user-1",
    ]);
    assert.ok(poolMock.calls[0].sql.includes("DELETE FROM notifications"));
  });
});

test("DELETE /api/notifications/delete/1 rejects spoofed uid (regression)", async () => {
  const poolMock = createPoolMock();
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/notifications/delete/11111111-1111-1111-1111-111111111111", {
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
    const response = await json("/api/notifications/delete/11111111-1111-1111-1111-111111111111", {
      method: "DELETE",
      headers: authHeaders(),
      body: { uid: "user-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.match(body.message, /Không tìm thấy thông báo/);
  });
});
