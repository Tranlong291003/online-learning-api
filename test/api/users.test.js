const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createFirebaseAdminMock,
  createPoolMock,
  loadApp,
  signTestToken,
  withServer,
} = require("../helpers/apiTestUtils");

const auth = (token) => ({ authorization: `Bearer ${token}` });

// ---------- POST /api/users/create ----------

test("POST /api/users/create returns 400 when required fields are missing", async () => {
  const { app } = loadApp();

  await withServer(app, async ({ json }) => {
    const bodies = [{}, { email: "a@b.com" }, { email: "a@b.com", password: "123456" }];
    for (const body of bodies) {
      const response = await json("/api/users/create", { method: "POST", body });
      const result = await response.json();
      assert.equal(response.status, 400);
      assert.equal(result.error, "Thiếu thông tin người dùng");
    }
  });
});

test("POST /api/users/create ignores role from request body (regression)", async () => {
  // Chỉ khai response cho INSERT; các truy vấn khác (đăng ký trùng email, refresh
  // token) nhận `{ rows: [] }` mặc định.
  const poolMock = createPoolMock([
    { rows: [] }, // kiểm tra email đã tồn tại -> chưa có
    {
      rows: [
        {
          uid: "u_regression",
          email: "reg@example.com",
          name: "Reg User",
          role: "user",
        },
      ],
    },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/users/create", {
      method: "POST",
      body: {
        email: "reg@example.com",
        password: "123456",
        name: "Reg User",
        role: "admin",
      },
    });
    const result = await response.json();

    assert.equal(response.status, 201);
    assert.equal(result.user.role, "user");

    const insert = poolMock.calls.find((call) => /INSERT INTO users/i.test(call.sql));
    assert.ok(insert, "phải có truy vấn INSERT INTO users");
    // Role luôn là 'user' cứng trong câu SQL, không lấy từ body.
    assert.match(insert.sql, /'user'/);
    assert.ok(
      !insert.params.includes("admin"),
      "role 'admin' từ body không được lọt vào tham số truy vấn"
    );
  });
});

// ---------- POST /api/users/login ----------

test("POST /api/users/login returns 400 when credentials are missing", async () => {
  const { app } = loadApp();

  await withServer(app, async ({ json }) => {
    for (const body of [{}, { email: "a@b.com" }, { password: "123456" }]) {
      const response = await json("/api/users/login", { method: "POST", body });
      const result = await response.json();

      assert.equal(response.status, 400);
      assert.equal(result.error, "Thiếu email hoặc mật khẩu");
    }
  });
});

test("POST /api/users/login returns 401 for unknown email or wrong password", async () => {
  // Không khai SQL nào -> mọi truy vấn trả `{ rows: [] }`, tức không tìm thấy
  // người dùng. API phải trả cùng một thông điệp cho cả hai trường hợp, nếu
  // không nó trở thành công cụ dò email đã đăng ký.
  const { app } = loadApp();

  await withServer(app, async ({ json }) => {
    const response = await json("/api/users/login", {
      method: "POST",
      body: { email: "khong-ton-tai@example.com", password: "123456" },
    });
    const result = await response.json();

    assert.equal(response.status, 401);
    assert.equal(result.error, "Email hoặc mật khẩu không đúng");
  });
});

test("POST /api/users/login rejects a deactivated account with 403", async () => {
  const poolMock = createPoolMock([
    {
      rows: [
        {
          uid: "user-1",
          email: "user@example.com",
          role: "user",
          is_active: false,
          password_hash: null,
          failed_login_attempts: 0,
          locked_until: null,
          fcm_token: null,
        },
      ],
    },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/users/login", {
      method: "POST",
      body: { email: "user@example.com", password: "123456" },
    });
    const result = await response.json();

    assert.equal(response.status, 403);
    assert.equal(result.error, "Tài khoản đã bị khoá");
  });
});

// ---------- GET /api/users/listmentor ----------

test("GET /api/users/listmentor returns mentor rows", async () => {
  const poolMock = createPoolMock([
    {
      rows: [
        {
          uid: "mentor-1",
          name: "Mentor One",
          avatar_url: null,
          bio: "bio",
          email: "mentor@example.com",
        },
      ],
    },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ request }) => {
    const response = await request("/api/users/listmentor", {
      headers: auth(signTestToken()),
    });
    const result = await response.json();

    assert.equal(response.status, 200);
    assert.equal(result.message, "Danh sách mentor");
    assert.equal(result.mentors.length, 1);
    assert.equal(result.mentors[0].uid, "mentor-1");
  });
});

// ---------- GET /api/users ----------

test("GET /api/users returns all users for admin", async () => {
  const poolMock = createPoolMock([
    {
      rows: [{ uid: "user-1", name: "One", role: "user", is_active: true }],
    },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ request }) => {
    const response = await request("/api/users", {
      headers: auth(signTestToken()),
    });
    const result = await response.json();

    assert.equal(response.status, 200);
    assert.equal(result.message, "Danh sách người dùng");
    assert.equal(result.users.length, 1);
  });
});

test("GET /api/users returns 403 for non-admin (regression)", async () => {
  const { app } = loadApp();

  await withServer(app, async ({ request }) => {
    const response = await request("/api/users", {
      headers: auth(signTestToken({ role: "user", uid: "student-1" })),
    });
    const result = await response.json();

    assert.equal(response.status, 403);
    assert.equal(result.error, "Bạn không có quyền xem danh sách người dùng");
  });
});

// ---------- GET /api/users/checkactive/:uid ----------

test("GET /api/users/checkactive/user-1 returns is_active true", async () => {
  const poolMock = createPoolMock([{ rows: [{ is_active: true }] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ request }) => {
    const response = await request("/api/users/checkactive/user-1", {
      headers: auth(signTestToken()),
    });
    const result = await response.json();

    assert.equal(response.status, 200);
    assert.equal(result.is_active, true);
  });
});

test("GET /api/users/checkactive/unknown returns 404", async () => {
  const { app } = loadApp();

  await withServer(app, async ({ request }) => {
    const response = await request("/api/users/checkactive/unknown", {
      headers: auth(signTestToken()),
    });
    const result = await response.json();

    assert.equal(response.status, 404);
    assert.equal(result.error, "Không tìm thấy người dùng");
  });
});

// ---------- GET /api/users/:id ----------

test("GET /api/users/user-1 returns user profile", async () => {
  const poolMock = createPoolMock([
    { rows: [{ uid: "user-1", name: "One", email: "one@example.com" }] },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ request }) => {
    const response = await request("/api/users/user-1", {
      headers: auth(signTestToken()),
    });
    const result = await response.json();

    assert.equal(response.status, 200);
    assert.equal(result.user.uid, "user-1");
    assert.equal(result.message, "Thông tin người dùng");
  });
});

test("GET /api/users/:id is a public profile readable by any logged-in user", async () => {
  // Màn "chi tiết mentor" của học viên cần email/sđt/bio của người dạy, nên
  // không thể giới hạn endpoint này cho chính chủ hay admin.
  const poolMock = createPoolMock([
    {
      rows: [
        {
          uid: "mentor-1",
          email: "mentor@example.com",
          name: "Mentor One",
          phone: "0900",
          bio: "bio",
          role: "mentor",
        },
      ],
    },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ request }) => {
    const response = await request("/api/users/mentor-1", {
      headers: auth(signTestToken({ uid: "student-1", role: "user" })),
    });
    const result = await response.json();

    assert.equal(response.status, 200, "học viên phải xem được hồ sơ mentor");
    assert.equal(result.user.uid, "mentor-1");
  });
});

test("GET /api/users/:id never exposes password_hash or account internals", async () => {
  const poolMock = createPoolMock([
    { rows: [{ uid: "user-1", name: "One", email: "one@example.com" }] },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ request }) => {
    await request("/api/users/user-1", { headers: auth(signTestToken()) });

    const sql = poolMock.calls[0].sql;
    // Truy vấn phải liệt kê cột tường minh, không dùng SELECT *.
    assert.doesNotMatch(sql, /SELECT\s+\*/i);
    for (const secret of [
      "password_hash",
      "failed_login_attempts",
      "locked_until",
      "fcm_token",
      "is_active",
    ]) {
      assert.ok(
        !sql.includes(secret),
        `hồ sơ công khai không được trả trường ${secret}`
      );
    }
  });
});

test("GET /api/users/checkactive/:uid is restricted to the owner or an admin", async () => {
  const poolMock = createPoolMock();
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ request }) => {
    const forbidden = await request("/api/users/checkactive/someone-else", {
      headers: auth(signTestToken({ uid: "student-1", role: "user" })),
    });
    assert.equal(forbidden.status, 403, "không được dò trạng thái khoá của người khác");
    assert.equal(poolMock.calls.length, 0);

    const asAdmin = await request("/api/users/checkactive/someone-else", {
      headers: auth(signTestToken({ uid: "admin-1", role: "admin" })),
    });
    // Qua được guard -> chạm DB -> 404 vì mock không có dữ liệu.
    assert.equal(asAdmin.status, 404);
  });
});

test("GET /api/users/unknown returns 404", async () => {
  const { app } = loadApp();

  await withServer(app, async ({ request }) => {
    const response = await request("/api/users/unknown", {
      headers: auth(signTestToken()),
    });
    const result = await response.json();

    assert.equal(response.status, 404);
    assert.equal(result.error, "Không tìm thấy người dùng");
  });
});

// ---------- PATCH /api/users/:id/status ----------

test("PATCH /api/users/user-1/status updates status as admin", async () => {
  const poolMock = createPoolMock([{ rows: [{ uid: "user-1" }] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/users/user-1/status", {
      method: "PATCH",
      headers: auth(signTestToken()),
      body: { status: "disabled" },
    });
    const result = await response.json();

    assert.equal(response.status, 200);
    assert.equal(result.message, "Trạng thái người dùng đã được cập nhật thành công");
    assert.match(poolMock.calls[0].sql, /UPDATE users/);
    assert.equal(poolMock.calls[0].params[0], false);
  });
});

test("PATCH /api/users/user-1/status returns 400 for invalid status", async () => {
  const { app } = loadApp();

  await withServer(app, async ({ json }) => {
    const response = await json("/api/users/user-1/status", {
      method: "PATCH",
      headers: auth(signTestToken()),
      body: { status: "banana" },
    });
    const result = await response.json();

    assert.equal(response.status, 400);
    assert.equal(result.error, "Trạng thái không hợp lệ");
  });
});

test("PATCH /api/users/user-1/status returns 403 for non-admin (regression)", async () => {
  const { app } = loadApp();

  await withServer(app, async ({ json }) => {
    const response = await json("/api/users/user-1/status", {
      method: "PATCH",
      headers: auth(signTestToken({ role: "user", uid: "student-1" })),
      body: { status: "active" },
    });
    const result = await response.json();

    assert.equal(response.status, 403);
    assert.equal(result.error, "Bạn không có quyền cập nhật trạng thái người dùng");
  });
});

test("PATCH /api/users/unknown/status returns 404 when user missing", async () => {
  const { app } = loadApp();

  await withServer(app, async ({ json }) => {
    const response = await json("/api/users/unknown/status", {
      method: "PATCH",
      headers: auth(signTestToken()),
      body: { status: "active" },
    });
    const result = await response.json();

    assert.equal(response.status, 404);
    assert.equal(result.error, "Không tìm thấy người dùng");
  });
});

// ---------- PUT /api/users/update/:id ----------

test("PUT /api/users/update/user-1 allows self-update and sends notification", async () => {
  const poolMock = createPoolMock([
    {
      rows: [
        {
          uid: "user-1",
          name: "New Name",
          phone: "0909",
          gender: null,
          birthdate: null,
          fcm_token: "fcm-1",
        },
      ],
    },
    { rows: [{ noti_id: 42 }] },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/users/update/user-1", {
      method: "PUT",
      headers: auth(signTestToken({ role: "user", uid: "user-1" })),
      body: { name: "New Name" },
    });
    const result = await response.json();

    assert.equal(response.status, 200);
    assert.equal(result.message, "Cập nhật thành công và thông báo đã được gửi");
    assert.equal(result.notification.noti_id, 42);
    assert.equal(result.notification.sent, true);
    assert.equal(poolMock.calls.length, 2);
  });
});

test("PUT /api/users/update/user-2 returns 403 when user edits another user (regression)", async () => {
  const poolMock = createPoolMock();
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/users/update/user-2", {
      method: "PUT",
      headers: auth(signTestToken({ role: "user", uid: "user-1" })),
      body: { name: "Hacker" },
    });
    const result = await response.json();

    assert.equal(response.status, 403);
    assert.equal(result.error, "Bạn không có quyền cập nhật người dùng này");
    assert.equal(poolMock.calls.length, 0);
  });
});

test("PUT /api/users/update/user-2 allows admin to update anyone", async () => {
  const poolMock = createPoolMock([
    {
      rows: [
        {
          uid: "user-2",
          name: "Target",
          phone: null,
          gender: null,
          birthdate: null,
          fcm_token: null,
        },
      ],
    },
    { rows: [{ noti_id: 7 }] },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/users/update/user-2", {
      method: "PUT",
      headers: auth(signTestToken()),
      body: { name: "Target Updated" },
    });
    const result = await response.json();

    assert.equal(response.status, 200);
    assert.equal(result.user.uid, "user-2");
    assert.equal(result.notification.noti_id, 7);
  });
});

// ---------- PUT /api/users/updaterole ----------

test("PUT /api/users/updaterole updates role and revokes existing sessions", async () => {
  const poolMock = createPoolMock([{ rows: [{ uid: "user-1" }] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/users/updaterole", {
      method: "PUT",
      headers: auth(signTestToken({ uid: "admin-1", role: "admin" })),
      body: { uid: "user-1", role: "mentor" },
    });
    const result = await response.json();

    assert.equal(response.status, 200);
    assert.equal(result.success, true);
    assert.equal(result.message, "Đã cập nhật role thành mentor");
    assert.match(poolMock.calls[0].sql, /UPDATE users SET role/);

    // Đổi quyền phải thu hồi refresh token của người bị đổi, nếu không họ giữ
    // được phiên cũ và tiếp tục làm mới access token.
    const revoked = poolMock.calls.find((call) =>
      /UPDATE refresh_tokens/i.test(call.sql)
    );
    assert.ok(revoked, "phải thu hồi refresh token sau khi đổi role");
    assert.deepEqual(revoked.params, ["user-1"]);
  });
});

test("PUT /api/users/updaterole blocks an admin from demoting themselves", async () => {
  const poolMock = createPoolMock([{ rows: [{ uid: "admin-1" }] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/users/updaterole", {
      method: "PUT",
      headers: auth(signTestToken({ uid: "admin-1", role: "admin" })),
      body: { uid: "admin-1", role: "user" },
    });
    const result = await response.json();

    assert.equal(response.status, 400);
    assert.match(result.error, /tự hạ quyền admin/);
    assert.equal(poolMock.calls.length, 0);
  });
});

test("PUT /api/users/updaterole returns 400 for invalid role", async () => {
  const { app } = loadApp();

  await withServer(app, async ({ json }) => {
    const response = await json("/api/users/updaterole", {
      method: "PUT",
      headers: auth(signTestToken()),
      body: { uid: "user-1", role: "superadmin" },
    });
    const result = await response.json();

    assert.equal(response.status, 400);
    assert.equal(result.error, "Role không hợp lệ");
  });
});

test("PUT /api/users/updaterole returns 403 for non-admin (regression)", async () => {
  const poolMock = createPoolMock();
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/users/updaterole", {
      method: "PUT",
      headers: auth(signTestToken({ role: "user", uid: "student-1" })),
      body: { uid: "user-1", role: "admin" },
    });
    const result = await response.json();

    assert.equal(response.status, 403);
    assert.equal(result.error, "Bạn không có quyền thay đổi vai trò");
    assert.equal(poolMock.calls.length, 0);
  });
});

// ---------- DELETE /api/users/delete/:id ----------

test("DELETE /api/users/delete/user-1 deletes user as admin", async () => {
  const poolMock = createPoolMock([{ rows: [{ uid: "user-1" }] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ request }) => {
    const response = await request("/api/users/delete/user-1", {
      method: "DELETE",
      headers: auth(signTestToken()),
    });
    const result = await response.json();

    assert.equal(response.status, 200);
    assert.equal(result.message, "Đã xóa người dùng thành công");
    assert.match(poolMock.calls[0].sql, /DELETE FROM users/);
  });
});

test("DELETE /api/users/delete/user-1 returns 403 for non-admin (regression)", async () => {
  const poolMock = createPoolMock();
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ request }) => {
    const response = await request("/api/users/delete/user-1", {
      method: "DELETE",
      headers: auth(signTestToken({ role: "user", uid: "student-1" })),
    });
    const result = await response.json();

    assert.equal(response.status, 403);
    assert.equal(result.error, "Bạn không có quyền xoá người dùng");
    assert.equal(poolMock.calls.length, 0);
  });
});

test("DELETE /api/users/delete/unknown returns 404 when user missing", async () => {
  const { app } = loadApp();

  await withServer(app, async ({ request }) => {
    const response = await request("/api/users/delete/unknown", {
      method: "DELETE",
      headers: auth(signTestToken()),
    });
    const result = await response.json();

    assert.equal(response.status, 404);
    assert.equal(result.error, "Không tìm thấy người dùng");
  });
});

test("DELETE /api/users/delete/user-1 returns 409 on foreign key violation (regression)", async () => {
  const poolMock = createPoolMock([
    () => {
      throw Object.assign(new Error("foreign key violation"), { code: "23503" });
    },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ request }) => {
    const response = await request("/api/users/delete/user-1", {
      method: "DELETE",
      headers: auth(signTestToken()),
    });
    const result = await response.json();

    assert.equal(response.status, 409);
    assert.equal(result.error, "Không thể xoá người dùng do còn dữ liệu liên quan");
  });
});
