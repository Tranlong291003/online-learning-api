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

function formDataWithImage(fields = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    form.append(key, value);
  }
  form.append(
    "image",
    new File(["fake-image-bytes"], "proof.png", { type: "image/png" })
  );
  return form;
}

test("POST /api/mentor-requests/ creates a pending request with image", async () => {
  const poolMock = createPoolMock([{ rows: [] }, { rows: [] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ request }) => {
    const response = await request("/api/mentor-requests/", {
      method: "POST",
      headers: authHeaders({ role: "user", uid: "student-1" }),
      body: formDataWithImage({ user_uid: "student-1" }),
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.message, "Yêu cầu đã được gửi");
    assert.ok(body.image_url.includes("student-1"));

    const insert = poolMock.calls.find((c) =>
      c.sql.trim().toLowerCase().startsWith("insert into upgrade_requests")
    );
    assert.ok(insert);
    assert.equal(insert.params[1], body.image_url);
  });
});

test("POST /api/mentor-requests/ returns 400 when no image file is sent", async () => {
  const poolMock = createPoolMock([]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/mentor-requests/", {
      method: "POST",
      headers: authHeaders({ role: "user", uid: "student-1" }),
      body: { user_uid: "student-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(
      body.error,
      "Vui lòng gửi file ảnh minh chứng (field 'image')"
    );
    assert.equal(poolMock.calls.length, 0);
  });
});

test("POST /api/mentor-requests/ returns 400 when a pending request already exists", async () => {
  const poolMock = createPoolMock([{ rows: [{ id: 1 }] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ request }) => {
    const response = await request("/api/mentor-requests/", {
      method: "POST",
      headers: authHeaders({ role: "user", uid: "student-1" }),
      body: formDataWithImage({ user_uid: "student-1" }),
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.ok(body.error.includes("đang chờ duyệt"));
  });
});

test("GET /api/mentor-requests/ returns requests for admin", async () => {
  const poolMock = createPoolMock([
    { rows: [{ id: 1, status: "pending", user_name: "Student One" }] },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ request }) => {
    const response = await request("/api/mentor-requests/", {
      headers: authHeaders(),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body[0].id, 1);
    assert.equal(body[0].user_name, "Student One");
  });
});

test("GET /api/mentor-requests/ returns 403 for non-admin users", async () => {
  const poolMock = createPoolMock([]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ request }) => {
    const response = await request("/api/mentor-requests/", {
      headers: authHeaders({ role: "user", uid: "student-1" }),
    });
    const body = await response.json();

    assert.equal(response.status, 403);
    assert.equal(body.error, "Bạn không có quyền thực hiện thao tác này");
    assert.equal(poolMock.calls.length, 0);
  });
});

test("PUT /api/mentor-requests/1/status rejects a request as admin", async () => {
  const poolMock = createPoolMock([
    { rows: [] },
    { rows: [{ user_uid: "student-1" }] },
    { rows: [{ fcm_token: null }] },
    { rows: [{ noti_id: 11 }] },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/mentor-requests/1/status", {
      method: "PUT",
      headers: authHeaders(),
      body: { status: "rejected", reason: "Thiếu giấy tờ" },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.message, "Yêu cầu đã được từ chối");
  });
});

test("PUT /api/mentor-requests/1/status returns 400 for invalid status", async () => {
  const poolMock = createPoolMock([]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/mentor-requests/1/status", {
      method: "PUT",
      headers: authHeaders(),
      body: { status: "maybe" },
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error, "Trạng thái không hợp lệ");
    assert.equal(poolMock.calls.length, 0);
  });
});

test("PUT /api/mentor-requests/1/status returns 403 for non-admin users", async () => {
  const poolMock = createPoolMock([]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/mentor-requests/1/status", {
      method: "PUT",
      headers: authHeaders({ role: "user", uid: "student-1" }),
      body: { status: "approved" },
    });
    const body = await response.json();

    assert.equal(response.status, 403);
    assert.equal(body.error, "Bạn không có quyền thực hiện thao tác này");
    assert.equal(poolMock.calls.length, 0);
  });
});

test("PUT /api/mentor-requests/1/status approved updates user role to mentor", async () => {
  const poolMock = createPoolMock([
    { rows: [] },
    { rows: [{ user_uid: "student-1" }] },
    { rows: [{ fcm_token: "fcm-token-1" }] },
    { rows: [] },
    { rows: [{ noti_id: 12 }] },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/mentor-requests/1/status", {
      method: "PUT",
      headers: authHeaders(),
      body: { status: "approved" },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.message, "Yêu cầu đã được duyệt");

    const roleUpdate = poolMock.calls.find((c) =>
      /update users set role\s*=\s*'mentor'/i.test(c.sql)
    );
    assert.ok(
      roleUpdate,
      "expected an UPDATE users SET role='mentor' query to run"
    );
    assert.equal(roleUpdate.params[0], "student-1");

    const order = poolMock.calls.map((c) => c.sql.trim().toLowerCase());
    const userUpdateIndex = order.findIndex((sql) =>
      sql.startsWith("update users set role")
    );
    assert.ok(
      userUpdateIndex > 0,
      "role update should run after the request lookups"
    );
  });
});
