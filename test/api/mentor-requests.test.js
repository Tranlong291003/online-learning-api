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

// PNG 1x1 hợp lệ. Tầng lưu trữ kiểm tra "chữ ký" (magic bytes) của file ảnh,
// không chỉ đuôi file, nên chuỗi giả bất kỳ sẽ bị từ chối với 400.
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

function formDataWithImage(fields = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    form.append(key, value);
  }
  form.append(
    "image",
    new File([TINY_PNG], "proof.png", { type: "image/png" })
  );
  return form;
}

test("POST /api/mentor-requests/ creates a pending request with image", async () => {
  // Thứ tự thật: middleware lưu file (INSERT uploaded_files) chạy TRƯỚC
  // controller, nên mock phải khớp theo nội dung SQL chứ không theo vị trí.
  const bySql = (sql) => {
    if (sql.includes("INSERT INTO uploaded_files")) return { rows: [] };
    if (sql.includes("SELECT role FROM users")) return { rows: [{ role: "user" }] };
    return { rows: [] };
  };
  const poolMock = createPoolMock(Array.from({ length: 12 }, () => bySql));
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
    // Tên file giờ do server sinh ngẫu nhiên (an toàn hơn tên gắn uid), và nội
    // dung file được lưu trong bảng uploaded_files thay vì ghi ra đĩa.
    assert.ok(
      body.image_url.startsWith("/uploads/mentor_requests/"),
      `image_url phải nằm trong /uploads/mentor_requests/, nhận: ${body.image_url}`
    );

    const fileInsert = poolMock.calls.find((c) => c.sql.includes("INSERT INTO uploaded_files"));
    assert.ok(fileInsert, "phải ghi file vào uploaded_files");

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
  // Truy vấn 1: kiểm tra role. Truy vấn 2: INSERT vào uploaded_files (tầng lưu
  // trữ file). Truy vấn 3: kiểm tra yêu cầu đang chờ duyệt.
  const bySql = (sql) => {
    if (sql.includes("SELECT role FROM users")) return { rows: [{ role: "user" }] };
    if (sql.includes("INSERT INTO uploaded_files")) return { rows: [] };
    return { rows: [{ id: 1 }] };
  };
  const poolMock = createPoolMock(Array.from({ length: 10 }, () => bySql));
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

test("POST /api/mentor-requests/ rejects a user who is already a mentor (regression)", async () => {
  // Trước đây không kiểm tra role: mentor gửi được yêu cầu, và khi admin duyệt
  // thì role bị ghi đè — một admin có thể tự hạ quyền mình thành mentor.
  const bySql = (sql) => {
    if (sql.includes("SELECT role FROM users")) return { rows: [{ role: "admin" }] };
    return { rows: [] };
  };
  const poolMock = createPoolMock(Array.from({ length: 6 }, () => bySql));
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ request }) => {
    const response = await request("/api/mentor-requests/", {
      method: "POST",
      headers: authHeaders({ role: "admin", uid: "admin-1" }),
      body: formDataWithImage({ user_uid: "admin-1" }),
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.match(body.error, /không cần gửi yêu cầu nâng cấp/);
    assert.ok(
      !poolMock.calls.some((c) => /INSERT INTO upgrade_requests/i.test(c.sql)),
      "không được tạo yêu cầu"
    );
  });
});

test("POST /api/mentor-requests/ rejects a file without a PNG/JPEG signature (regression)", async () => {
  // Chỉ kiểm tra đuôi file là chưa đủ: file văn bản đổi tên .png từng đi lọt.
  const poolMock = createPoolMock([]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ request }) => {
    const form = new FormData();
    form.append("user_uid", "student-1");
    form.append("image", new File(["<script>alert(1)</script>"], "xss.png", { type: "image/png" }));

    const response = await request("/api/mentor-requests/", {
      method: "POST",
      headers: authHeaders({ role: "user", uid: "student-1" }),
      body: form,
    });

    assert.equal(response.status, 400);
    assert.equal(poolMock.calls.length, 0);
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
    // UPDATE ... RETURNING user_uid
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

test("PUT /api/mentor-requests/999/status returns 404 when the request does not exist (regression)", async () => {
  // Trước đây UPDATE không kiểm tra kết quả, nên id bịa vẫn trả 200 "đã duyệt"
  // và admin tưởng đã xử lý xong.
  const poolMock = createPoolMock([{ rows: [] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/mentor-requests/999/status", {
      method: "PUT",
      headers: authHeaders(),
      body: { status: "approved" },
    });
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.match(body.error, /Không tìm thấy yêu cầu nâng cấp/);
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
    // UPDATE ... RETURNING user_uid
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
