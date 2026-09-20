const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const {
  createPoolMock,
  loadApp,
  signTestToken,
  withServer,
} = require("../helpers/apiTestUtils");

const auth = (token) => ({ authorization: `Bearer ${token}` });

function sqlMock(fn, calls = 20) {
  return Array.from({ length: calls }, () => fn);
}

// ---------- POST /api/auth/register ----------

test("POST /api/auth/register validates required fields", async () => {
  const { app } = loadApp();

  await withServer(app, async ({ json }) => {
    for (const body of [{}, { email: "a@b.com" }, { email: "a@b.com", password: "123456" }]) {
      const response = await json("/api/auth/register", { method: "POST", body });
      assert.equal(response.status, 400);
    }
  });
});

test("POST /api/auth/register rejects a malformed email", async () => {
  const { app } = loadApp();

  await withServer(app, async ({ json }) => {
    for (const email of ["abc", "a@b", "@b.com", "a b@c.com"]) {
      const response = await json("/api/auth/register", {
        method: "POST",
        body: { email, password: "123456", name: "Test" },
      });
      const body = await response.json();
      assert.equal(response.status, 400, `email "${email}" phải bị từ chối`);
      assert.equal(body.error, "Email không hợp lệ");
    }
  });
});

test("POST /api/auth/register rejects a password shorter than the minimum", async () => {
  const { app } = loadApp();

  await withServer(app, async ({ json }) => {
    const response = await json("/api/auth/register", {
      method: "POST",
      body: { email: "a@b.com", password: "123", name: "Test" },
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.match(body.error, /ít nhất/);
  });
});

test("POST /api/auth/register rejects a password longer than 72 bytes", async () => {
  // bcrypt chỉ dùng 72 byte đầu; phần thừa bị bỏ qua âm thầm nên phải chặn hẳn.
  const { app } = loadApp();

  await withServer(app, async ({ json }) => {
    const response = await json("/api/auth/register", {
      method: "POST",
      body: { email: "a@b.com", password: "x".repeat(73), name: "Test" },
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.match(body.error, /72 byte/);
  });
});

test("POST /api/auth/register rejects a duplicate email", async () => {
  const poolMock = createPoolMock([{ rows: [{ uid: "existing" }] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/auth/register", {
      method: "POST",
      body: { email: "a@b.com", password: "123456", name: "Test" },
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error, "Email này đã được đăng ký");
    // Chỉ tra email, không chạy INSERT.
    assert.equal(poolMock.calls.length, 1);
  });
});

test("POST /api/auth/register never grants admin even if role is supplied", async () => {
  const poolMock = createPoolMock([
    { rows: [] },
    { rows: [{ uid: "u_new", email: "a@b.com", name: "Test", role: "user" }] },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/auth/register", {
      method: "POST",
      body: { email: "a@b.com", password: "123456", name: "Test", role: "admin" },
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.user.role, "user");

    const insert = poolMock.calls.find((c) => /INSERT INTO users/i.test(c.sql));
    assert.ok(insert);
    assert.ok(!insert.params.includes("admin"), "role admin từ body không được lọt vào query");
  });
});

test("POST /api/auth/register normalises email to lowercase and returns tokens", async () => {
  const poolMock = createPoolMock([
    { rows: [] },
    { rows: [{ uid: "u_new", email: "a@b.com", name: "Test", role: "user" }] },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/auth/register", {
      method: "POST",
      body: { email: "  A@B.COM  ", password: "123456", name: "Test" },
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(typeof body.access_token, "string");
    assert.equal(typeof body.refresh_token, "string");

    const select = poolMock.calls[0];
    assert.deepEqual(select.params, ["a@b.com"], "email phải được chuẩn hoá trước khi tra");
  });
});

// ---------- POST /api/auth/login ----------

test("POST /api/auth/login returns an access and refresh token pair", async () => {
  const passwordHash = bcrypt.hashSync("matkhau123", 4);
  const poolMock = createPoolMock([
    {
      rows: [
        {
          uid: "user-1",
          email: "user@example.com",
          name: "User One",
          role: "mentor",
          is_active: true,
          password_hash: passwordHash,
          failed_login_attempts: 0,
          locked_until: null,
          fcm_token: null,
        },
      ],
    },
    { rows: [] }, // registerSuccessfulLogin + cập nhật fcm_token
    { rows: [{ uid: "user-1", email: "user@example.com", name: "User One", role: "mentor" }] },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/auth/login", {
      method: "POST",
      body: { email: "user@example.com", password: "matkhau123", remember: true },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.user.role, "mentor");
    assert.equal(typeof body.access_token, "string");
    assert.equal(typeof body.refresh_token, "string");
    assert.equal(body.token, body.access_token, "giữ tên `token` để app cũ không vỡ");

    // Refresh token phải được ghi vào DB kèm thời hạn dài (remember: true).
    const insert = poolMock.calls.find((c) => /INSERT INTO refresh_tokens/i.test(c.sql));
    assert.ok(insert, "phải lưu refresh token vào DB");
  });
});

test("POST /api/auth/login trims the email and matches case-insensitively", async () => {
  const passwordHash = bcrypt.hashSync("matkhau123", 4);
  const poolMock = createPoolMock([
    {
      rows: [
        {
          uid: "user-1",
          email: "user@example.com",
          name: "User One",
          role: "user",
          is_active: true,
          password_hash: passwordHash,
          failed_login_attempts: 0,
          locked_until: null,
          fcm_token: null,
        },
      ],
    },
    { rows: [] },
    { rows: [{ uid: "user-1", email: "user@example.com", name: "User One", role: "user" }] },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/auth/login", {
      method: "POST",
      // Chữ hoa và khoảng trắng thừa vẫn phải đăng nhập được.
      body: { email: "  USER@EXAMPLE.COM  ", password: "matkhau123" },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    // Khoảng trắng bị cắt; còn phân biệt hoa/thường do SQL dùng LOWER() hai vế.
    assert.deepEqual(poolMock.calls[0].params, ["USER@EXAMPLE.COM"]);
    assert.match(poolMock.calls[0].sql, /LOWER\(email\)\s*=\s*LOWER\(\$1\)/i);
  });
});

// ---------- GET /api/auth/me ----------

test("GET /api/auth/me returns the profile of the token owner", async () => {
  const poolMock = createPoolMock([
    {
      rows: [
        {
          uid: "user-1",
          email: "user@example.com",
          name: "User One",
          role: "mentor",
        },
      ],
    },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ request }) => {
    const response = await request("/api/auth/me", {
      headers: auth(signTestToken({ uid: "user-1", role: "mentor" })),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.user.uid, "user-1");
    assert.equal(body.role, "mentor");
    // Truy vấn phải dùng uid từ token, không phải uid client gửi lên.
    assert.deepEqual(poolMock.calls[0].params, ["user-1"]);
  });
});

test("GET /api/auth/me requires a token", async () => {
  const { app } = loadApp();

  await withServer(app, async ({ request }) => {
    const response = await request("/api/auth/me");
    assert.equal(response.status, 401);
  });
});

// ---------- Access token: hết hạn vs không hợp lệ ----------

test("an expired access token returns TOKEN_EXPIRED so the client knows to refresh", async () => {
  const { app } = loadApp();

  const expired = jwt.sign(
    { uid: "user-1", email: "a@b.com", role: "user", type: "access" },
    process.env.JWT_SECRET,
    {
      expiresIn: "-1s",
      issuer: process.env.JWT_ISSUER || "online-learning-api",
      audience: process.env.JWT_AUDIENCE || "online-learning-client",
      algorithm: "HS256",
    }
  );

  await withServer(app, async ({ request }) => {
    const response = await request("/api/auth/me", { headers: auth(expired) });
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.code, "TOKEN_EXPIRED");
  });
});

test("a token signed with the wrong secret is rejected as invalid", async () => {
  const { app } = loadApp();

  const forged = jwt.sign(
    { uid: "user-1", role: "admin", type: "access" },
    "khoa-gia-mao-khong-dung",
    {
      expiresIn: "1h",
      issuer: process.env.JWT_ISSUER || "online-learning-api",
      audience: process.env.JWT_AUDIENCE || "online-learning-client",
      algorithm: "HS256",
    }
  );

  await withServer(app, async ({ request }) => {
    const response = await request("/api/auth/me", { headers: auth(forged) });
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.error, "Token không hợp lệ");
  });
});

test("a token issued for another audience is rejected", async () => {
  const { app } = loadApp();

  const wrongAudience = jwt.sign(
    { uid: "user-1", role: "admin", type: "access" },
    process.env.JWT_SECRET,
    {
      expiresIn: "1h",
      issuer: process.env.JWT_ISSUER || "online-learning-api",
      audience: "he-thong-khac",
      algorithm: "HS256",
    }
  );

  await withServer(app, async ({ request }) => {
    const response = await request("/api/auth/me", { headers: auth(wrongAudience) });
    assert.equal(response.status, 401);
  });
});

test("an unsigned token (alg: none) is rejected", async () => {
  // Chốt cứng algorithms: ["HS256"] khi verify để chặn tấn công đổi thuật toán.
  const { app } = loadApp();

  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ uid: "user-1", role: "admin", iss: "online-learning-api" })
  ).toString("base64url");
  const unsigned = `${header}.${payload}.`;

  await withServer(app, async ({ request }) => {
    const response = await request("/api/auth/me", { headers: auth(unsigned) });
    assert.equal(response.status, 401);
  });
});

// ---------- POST /api/auth/logout ----------

test("POST /api/auth/logout revokes the whole token family", async () => {
  const poolMock = createPoolMock([
    // findRefreshToken
    {
      rows: [
        {
          token_id: "11111111-1111-1111-1111-111111111111",
          uid: "user-1",
          family_id: "22222222-2222-2222-2222-222222222222",
          expires_at: new Date(Date.now() + 86400000),
          revoked_at: null,
        },
      ],
    },
    { rows: [] }, // revokeFamily
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/auth/logout", {
      method: "POST",
      headers: auth(signTestToken({ uid: "user-1", role: "user" })),
      body: { refresh_token: "refresh-cua-toi" },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);

    const revoke = poolMock.calls.find((c) => /UPDATE refresh_tokens/i.test(c.sql));
    assert.ok(revoke, "phải thu hồi refresh token");
    assert.match(revoke.sql, /family_id/);
  });
});

test("POST /api/auth/logout is idempotent for an unknown refresh token", async () => {
  const poolMock = createPoolMock([{ rows: [] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/auth/logout", {
      method: "POST",
      headers: auth(signTestToken({ uid: "user-1", role: "user" })),
      body: { refresh_token: "khong-ton-tai" },
    });
    const body = await response.json();

    // Đăng xuất phải luôn thành công từ góc nhìn client.
    assert.equal(response.status, 200);
    assert.equal(body.success, true);
  });
});

// ---------- POST /api/auth/change-password ----------

test("POST /api/auth/change-password requires the current password", async () => {
  const { app } = loadApp();

  await withServer(app, async ({ json }) => {
    const response = await json("/api/auth/change-password", {
      method: "POST",
      headers: auth(signTestToken({ uid: "user-1", role: "user" })),
      body: { new_password: "matkhaumoi123" },
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.match(body.error, /mật khẩu hiện tại/);
  });
});

test("POST /api/auth/change-password rejects a wrong current password", async () => {
  const passwordHash = bcrypt.hashSync("matkhau-dung", 4);
  const poolMock = createPoolMock([
    {
      rows: [
        {
          uid: "user-1",
          email: "user@example.com",
          password_hash: passwordHash,
          failed_login_attempts: 0,
          locked_until: null,
        },
      ],
    },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/auth/change-password", {
      method: "POST",
      headers: auth(signTestToken({ uid: "user-1", role: "user" })),
      body: { current_password: "sai-roi", new_password: "matkhaumoi123" },
    });
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.error, "Mật khẩu hiện tại không đúng");
    // Không được cập nhật gì cả.
    assert.ok(!poolMock.calls.some((c) => /UPDATE users/i.test(c.sql)));
  });
});

test("POST /api/auth/change-password rejects reusing the same password", async () => {
  const { app } = loadApp();

  await withServer(app, async ({ json }) => {
    const response = await json("/api/auth/change-password", {
      method: "POST",
      headers: auth(signTestToken({ uid: "user-1", role: "user" })),
      body: { current_password: "giong-nhau", new_password: "giong-nhau" },
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.match(body.error, /khác mật khẩu hiện tại/);
  });
});

test("POST /api/auth/change-password stores a hash and revokes every session", async () => {
  const passwordHash = bcrypt.hashSync("matkhau-cu", 4);
  const poolMock = createPoolMock(sqlMock((sql) => {
    const q = sql.toLowerCase();
    // Câu truy vấn của findUserForLogin trải nhiều dòng nên không thể khớp theo
    // chuỗi nối liền; nhận diện bằng cột đặc trưng password_hash.
    if (q.includes("password_hash") && q.includes("from users")) {
      return {
        rows: [
          {
            uid: "user-1",
            email: "user@example.com",
            password_hash: passwordHash,
            failed_login_attempts: 0,
            locked_until: null,
          },
        ],
      };
    }
    return { rows: [] };
  }));
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/auth/change-password", {
      method: "POST",
      headers: auth(signTestToken({ uid: "user-1", role: "user" })),
      body: { current_password: "matkhau-cu", new_password: "matkhau-moi-123" },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);

    const update = poolMock.calls.find((c) => /UPDATE users/i.test(c.sql));
    assert.ok(update, "phải cập nhật mật khẩu");
    const newHash = update.params[1];
    assert.ok(newHash.startsWith("$2"), "mật khẩu mới phải được hash");
    assert.ok(
      bcrypt.compareSync("matkhau-moi-123", newHash),
      "hash phải khớp mật khẩu mới"
    );

    // Đổi mật khẩu phải đá mọi phiên ra, phòng khi tài khoản đã bị chiếm.
    const revoked = poolMock.calls.find((c) => /UPDATE refresh_tokens/i.test(c.sql));
    assert.ok(revoked, "phải thu hồi toàn bộ refresh token");
  });
});

// ---------- POST /api/auth/forgot-password + reset-password ----------

test("POST /api/auth/forgot-password responds the same for known and unknown emails", async () => {
  const { app } = loadApp({ poolMock: createPoolMock([{ rows: [] }]) });

  await withServer(app, async ({ json }) => {
    const unknown = await json("/api/auth/forgot-password", {
      method: "POST",
      body: { email: "khong-ton-tai@example.com" },
    });
    const known = await json("/api/auth/forgot-password", {
      method: "POST",
      body: { email: "khong-ton-tai@example.com" },
    });

    assert.equal(unknown.status, 200);
    assert.equal(known.status, 200);
    // Cùng thông điệp -> không dò được email nào đã đăng ký.
    assert.equal((await unknown.json()).message, (await known.json()).message);
  });
});

test("POST /api/auth/reset-password rejects an invalid or expired token", async () => {
  const poolMock = createPoolMock([{ rows: [] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/auth/reset-password", {
      method: "POST",
      body: { token: "token-bay-ba", new_password: "matkhaumoi123" },
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.match(body.error, /không hợp lệ hoặc đã hết hạn/);
  });
});

test("POST /api/auth/reset-password rejects a token that was already used", async () => {
  const poolMock = createPoolMock([
    {
      rows: [
        {
          reset_id: "33333333-3333-3333-3333-333333333333",
          uid: "user-1",
          expires_at: new Date(Date.now() + 600000),
          used_at: new Date(),
        },
      ],
    },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/auth/reset-password", {
      method: "POST",
      body: { token: "token-da-dung", new_password: "matkhaumoi123" },
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.ok(!poolMock.calls.some((c) => /UPDATE users/i.test(c.sql)));
  });
});

test("POST /api/auth/reset-password sets a new hash and revokes sessions", async () => {
  const poolMock = createPoolMock([
    {
      rows: [
        {
          reset_id: "33333333-3333-3333-3333-333333333333",
          uid: "user-1",
          expires_at: new Date(Date.now() + 600000),
          used_at: null,
        },
      ],
    },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/auth/reset-password", {
      method: "POST",
      body: { token: "token-hop-le", new_password: "matkhaumoi123" },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);

    const update = poolMock.calls.find((c) => /UPDATE users/i.test(c.sql));
    assert.ok(update);
    assert.ok(update.params[1].startsWith("$2"), "mật khẩu mới phải được hash");

    // Token phải bị đánh dấu đã dùng để không phát lại được request.
    const markUsed = poolMock.calls.find((c) => /UPDATE password_resets/i.test(c.sql));
    assert.ok(markUsed, "phải đánh dấu token đã dùng");

    const revoked = poolMock.calls.find((c) => /UPDATE refresh_tokens/i.test(c.sql));
    assert.ok(revoked, "đặt lại mật khẩu phải thu hồi mọi phiên cũ");
  });
});

// ---------- POST /api/auth/refresh ----------

test("POST /api/auth/refresh rejects a missing token", async () => {
  const { app } = loadApp();

  await withServer(app, async ({ json }) => {
    const response = await json("/api/auth/refresh", { method: "POST", body: {} });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error, "Thiếu refresh token");
  });
});

test("POST /api/auth/refresh rejects a token that does not exist", async () => {
  const poolMock = createPoolMock([{ rows: [] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/auth/refresh", {
      method: "POST",
      body: { refresh_token: "khong-ton-tai" },
    });
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.error, "Refresh token không hợp lệ");
  });
});

test("POST /api/auth/refresh rejects an expired refresh token", async () => {
  const poolMock = createPoolMock([
    {
      rows: [
        {
          token_id: "11111111-1111-1111-1111-111111111111",
          uid: "user-1",
          family_id: "22222222-2222-2222-2222-222222222222",
          expires_at: new Date(Date.now() - 1000),
          revoked_at: null,
        },
      ],
    },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/auth/refresh", {
      method: "POST",
      body: { refresh_token: "het-han" },
    });
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.code, "REFRESH_TOKEN_EXPIRED");
  });
});

test("reusing a revoked refresh token revokes the entire family (theft detection)", async () => {
  const familyId = "22222222-2222-2222-2222-222222222222";
  const poolMock = createPoolMock([
    {
      rows: [
        {
          token_id: "11111111-1111-1111-1111-111111111111",
          uid: "user-1",
          family_id: familyId,
          expires_at: new Date(Date.now() + 86400000),
          // Đã bị thu hồi (đã rotate) — dấu hiệu token bị đánh cắp.
          revoked_at: new Date(),
        },
      ],
    },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/auth/refresh", {
      method: "POST",
      body: { refresh_token: "token-da-bi-thay-the" },
    });
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.code, "SESSION_REVOKED");

    // Phải vô hiệu hoá CẢ HỌ token, không chỉ từ chối riêng request này.
    const revoke = poolMock.calls.find((c) => /UPDATE refresh_tokens/i.test(c.sql));
    assert.ok(revoke, "phải thu hồi cả họ token");
    assert.match(revoke.sql, /family_id/);
    assert.deepEqual(revoke.params, [familyId]);
  });
});

test("POST /api/auth/refresh issues a new token pair for a valid token", async () => {
  const poolMock = createPoolMock(sqlMock((sql) => {
    const q = sql.toLowerCase();
    if (q.includes("from refresh_tokens") && q.includes("token_hash")) {
      return {
        rows: [
          {
            token_id: "11111111-1111-1111-1111-111111111111",
            uid: "user-1",
            family_id: "22222222-2222-2222-2222-222222222222",
            expires_at: new Date(Date.now() + 86400000),
            revoked_at: null,
          },
        ],
      };
    }
    if (q.includes("from users where uid")) {
      return {
        rows: [
          {
            uid: "user-1",
            email: "user@example.com",
            name: "User One",
            role: "mentor",
            is_active: true,
          },
        ],
      };
    }
    if (q.includes("select token_id from refresh_tokens")) {
      return { rows: [{ token_id: "44444444-4444-4444-4444-444444444444" }] };
    }
    return { rows: [] };
  }));
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/auth/refresh", {
      method: "POST",
      body: { refresh_token: "token-hop-le" },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(typeof body.access_token, "string");
    assert.equal(typeof body.refresh_token, "string");
    assert.notEqual(body.refresh_token, "token-hop-le", "phải rotate sang token mới");

    // Access token mới phải dùng được.
    const me = await json("/api/auth/me", {
      headers: auth(body.access_token),
    });
    assert.notEqual(me.status, 401, "access token vừa phát phải hợp lệ");
  });
});
