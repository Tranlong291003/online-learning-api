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

test("POST /api/users/create creates Firebase and database user with mocks", async () => {
  const poolMock = createPoolMock([{ rows: [] }]);
  const { app } = loadApp({
    poolMock,
    firebaseAdmin: createFirebaseAdminMock({
      auth: {
        createUser: async () => ({ uid: "created-user-1" }),
      },
    }),
  });

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
    assert.equal(body.message, "Người dùng đã được tạo thành công");
    assert.equal(body.user_id, "created-user-1");
    assert.equal(poolMock.calls.length, 1);
    assert.match(poolMock.calls[0].sql, /INSERT INTO users/);
  });
});

test("POST /api/users/login returns JWT for active user with mocks", async () => {
  const poolMock = createPoolMock([
    { rows: [{ role: "mentor", is_active: true, fcm_token: null }] },
    { rows: [] },
  ]);
  const { app } = loadApp({
    poolMock,
    firebaseAdmin: createFirebaseAdminMock({
      auth: {
        verifyIdToken: async () => ({ uid: "login-user-1" }),
        getUser: async () => ({
          uid: "login-user-1",
          email: "login@example.com",
          customClaims: {},
        }),
      },
    }),
  });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/users/login", {
      method: "POST",
      body: { idToken: "firebase-token", fcmToken: "fcm-token" },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.user_id, "login-user-1");
    assert.equal(body.role, "mentor");
    assert.equal(typeof body.token, "string");
  });
});
