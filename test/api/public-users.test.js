const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createFirebaseAdminMock,
  createPoolMock,
  loadApp,
  withServer,
} = require("../helpers/apiTestUtils");

test("POST /api/users/create validates required signup fields", async () => {
  const { app } = loadApp();

  await withServer(app, async ({ json }) => {
    const response = await json("/api/users/create", {
      method: "POST",
      body: { email: "user@example.com" },
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error, "Thiếu thông tin người dùng");
  });
});

test("POST /api/users/create creates a database user with a hashed password", async () => {
  const poolMock = createPoolMock([
    { rows: [] }, // email chưa tồn tại
    {
      rows: [
        {
          uid: "u_created",
          email: "new@example.com",
          name: "New User",
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
        email: "new@example.com",
        password: "123456",
        name: "New User",
      },
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.message, "Đăng ký thành công");
    assert.equal(body.user.role, "user");
    assert.equal(typeof body.access_token, "string");

    const insert = poolMock.calls.find((call) => /INSERT INTO users/i.test(call.sql));
    assert.ok(insert, "phải có truy vấn INSERT INTO users");

    // Mật khẩu phải được hash trước khi lưu; không bao giờ lưu bản rõ.
    const storedHash = insert.params.find((p) => typeof p === "string" && p.startsWith("$2"));
    assert.ok(storedHash, "mật khẩu phải được hash bằng bcrypt (tiền tố $2)");
    assert.ok(
      !insert.params.includes("123456"),
      "mật khẩu dạng rõ không được lọt vào tham số truy vấn"
    );
  });
});

test("POST /api/users/login returns tokens for an active user with correct password", async () => {
  const bcrypt = require("bcryptjs");
  const passwordHash = bcrypt.hashSync("matkhau123", 4);

  const poolMock = createPoolMock([
    {
      rows: [
        {
          uid: "user-1",
          email: "login@example.com",
          name: "Login User",
          role: "mentor",
          is_active: true,
          password_hash: passwordHash,
          failed_login_attempts: 0,
          locked_until: null,
          fcm_token: null,
        },
      ],
    },
    { rows: [] }, // reset bộ đếm + cập nhật fcm_token
    {
      rows: [
        {
          uid: "user-1",
          email: "login@example.com",
          name: "Login User",
          role: "mentor",
        },
      ],
    },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/users/login", {
      method: "POST",
      body: { email: "login@example.com", password: "matkhau123", fcmToken: "fcm-token" },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.user.uid, "user-1");
    assert.equal(body.user.role, "mentor");
    assert.equal(typeof body.access_token, "string");
    assert.equal(typeof body.refresh_token, "string");
    // Trường `token` giữ lại để app đang chạy không vỡ.
    assert.equal(body.token, body.access_token);
  });
});

test("POST /api/users/login rejects a wrong password without revealing the email exists", async () => {
  const bcrypt = require("bcryptjs");
  const passwordHash = bcrypt.hashSync("dung-roi", 4);

  const poolMock = createPoolMock([
    {
      rows: [
        {
          uid: "user-1",
          email: "login@example.com",
          role: "user",
          is_active: true,
          password_hash: passwordHash,
          failed_login_attempts: 0,
          locked_until: null,
          fcm_token: null,
        },
      ],
    },
    { rows: [{ failed_login_attempts: 1, locked_until: null }] }, // ghi nhận sai
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/users/login", {
      method: "POST",
      body: { email: "login@example.com", password: "sai-mat-khau" },
    });
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.error, "Email hoặc mật khẩu không đúng");
  });
});

test("POST /api/users/login locks the account after too many failed attempts", async () => {
  const bcrypt = require("bcryptjs");
  const passwordHash = bcrypt.hashSync("dung-roi", 4);

  const poolMock = createPoolMock([
    {
      rows: [
        {
          uid: "user-1",
          email: "login@example.com",
          role: "user",
          is_active: true,
          password_hash: passwordHash,
          failed_login_attempts: 0,
          locked_until: null,
          fcm_token: null,
        },
      ],
    },
    // Lần sai này chạm ngưỡng -> DB trả về locked_until trong tương lai
    {
      rows: [
        {
          failed_login_attempts: 10,
          locked_until: new Date(Date.now() + 15 * 60 * 1000),
        },
      ],
    },
    { rows: [] }, // đặt lại bộ đếm sau khi khoá
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/users/login", {
      method: "POST",
      body: { email: "login@example.com", password: "sai-mat-khau" },
    });
    const body = await response.json();

    assert.equal(response.status, 429);
    assert.equal(body.code, "ACCOUNT_LOCKED");
    assert.match(body.error, /tạm bị khoá/);
  });
});

test("POST /api/users/login refuses a temporarily locked account before checking the password", async () => {
  const poolMock = createPoolMock([
    {
      rows: [
        {
          uid: "user-1",
          email: "login@example.com",
          role: "user",
          is_active: true,
          password_hash: "$2a$04$abcdefghijklmnopqrstuv",
          failed_login_attempts: 0,
          locked_until: new Date(Date.now() + 10 * 60 * 1000),
          fcm_token: null,
        },
      ],
    },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/users/login", {
      method: "POST",
      body: { email: "login@example.com", password: "bat-ky" },
    });
    const body = await response.json();

    assert.equal(response.status, 429);
    assert.equal(body.code, "ACCOUNT_LOCKED");
    // Chỉ một truy vấn duy nhất (tra user). Tài khoản đang bị khoá thì không tốn
    // CPU cho bcrypt và không ghi thêm lần sai nào.
    assert.equal(poolMock.calls.length, 1);
  });
});
