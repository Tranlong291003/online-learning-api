const http = require("node:http");
const path = require("node:path");
const jwt = require("jsonwebtoken");

const projectRoot = path.resolve(__dirname, "..", "..");
const srcRoot = path.join(projectRoot, "src");

function clearProjectModules() {
  for (const key of Object.keys(require.cache)) {
    if (key.startsWith(srcRoot)) {
      delete require.cache[key];
    }
  }
}

function mockModule(modulePath, exports) {
  const resolved = require.resolve(modulePath);
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports,
  };
}

function createPoolMock(responses = []) {
  const calls = [];
  const queue = [...responses];

  const nextResponse = async (sql, params) => {
    calls.push({ sql, params });
    const response = queue.length > 0 ? queue.shift() : { rows: [] };
    if (typeof response === "function") {
      return response(sql, params, calls);
    }
    return response;
  };

  const client = {
    query: nextResponse,
    release: () => {},
  };

  return {
    calls,
    queue,
    pool: {
      query: nextResponse,
      connect: async () => client,
      on: () => {},
      end: async () => {},
    },
  };
}

function createFirebaseAdminMock(overrides = {}) {
  const authApi = {
    getUserByEmail: async () => {
      const error = new Error("User not found");
      error.code = "auth/user-not-found";
      throw error;
    },
    createUser: async (user) => ({ uid: "firebase-user-1", ...user }),
    verifyIdToken: async () => ({ uid: "firebase-user-1" }),
    getUser: async () => ({
      uid: "firebase-user-1",
      email: "user@example.com",
      customClaims: {},
    }),
    deleteUser: async () => {},
    setCustomUserClaims: async () => {},
    updateUser: async () => {},
    ...overrides.auth,
  };

  return {
    auth: () => authApi,
    credential: { cert: () => ({}) },
    initializeApp: () => {},
    messaging: () => ({
      send: async () => "mock-message-id",
      ...overrides.messaging,
    }),
  };
}

/**
 * Sổ đăng ký user cho test: uid -> { role, is_active }.
 *
 * `signTestToken` tự ghi vào đây mỗi khi ký token, nên middleware xác thực (vốn
 * đối chiếu role/is_active với DB) nhìn thấy đúng trạng thái mà test mong đợi.
 * Nhờ vậy test không cần khai báo thêm gì, mà vẫn kiểm tra được đúng luồng thật.
 */
const testUserRegistry = new Map();

function loadApp(options = {}) {
  process.env.JWT_SECRET = options.jwtSecret || "test-secret-key-with-at-least-32-chars";
  process.env.NODE_ENV = "test";
  process.env.OPENAI_API_KEY = "test-openai-key";
  // bcrypt cost 12 (mặc định production) khiến mỗi lần hash mất hàng trăm ms —
  // đủ để cả bộ test chậm hẳn. Cost 4 vẫn giữ nguyên ngữ nghĩa, chỉ nhanh hơn.
  process.env.BCRYPT_ROUNDS = options.bcryptRounds || "4";

  clearProjectModules();

  const poolMock = options.poolMock || createPoolMock();
  const firebaseAdmin = options.firebaseAdmin || createFirebaseAdminMock();

  // Thứ tự quan trọng: mock db.config TRƯỚC, để khi nạp bản thật của
  // authUserLookup bên dưới thì nó nhận pool giả thay vì tạo kết nối thật.
  mockModule(path.join(srcRoot, "config", "db.config.js"), { pool: poolMock.pool });
  mockModule(path.join(srcRoot, "config", "firebase.config.js"), firebaseAdmin);
  mockModule("firebase-admin", firebaseAdmin);

  // Middleware xác thực tra cứu role/is_active từ DB. Chỉ thay `getAuthStateForUid`
  // để test không phải xếp hàng response SQL cho mỗi request, nhưng vẫn giữ đúng
  // ngữ nghĩa: uid không có trong sổ -> null (bị chặn), is_active=false -> bị chặn.
  //
  // Các hàm còn lại (findUserForLogin, setPasswordHash...) giữ nguyên bản thật và
  // chạy qua poolMock, nên luồng đăng nhập/đặt lại mật khẩu vẫn được test thật.
  const realAuthUserLookup = require(path.join(srcRoot, "services", "authUserLookup.js"));
  mockModule(path.join(srcRoot, "services", "authUserLookup.js"), {
    ...realAuthUserLookup,
    getAuthStateForUid: async (uid) => {
      if (!testUserRegistry.has(uid)) return null;
      return testUserRegistry.get(uid);
    },
  });
  // Không mock tokenService: poolMock đã trả `{ rows: [] }` cho mọi SQL không
  // được khai báo, nên các truy vấn vào refresh_tokens/password_resets trở thành
  // no-op và logic thật (ký/verify/rotate) vẫn được test chạy qua.
  mockModule(path.join(srcRoot, "services", "notificationService.js"), {
    sendNotification: async () => "mock-message-id",
  });
  mockModule("openai", options.openai || {
    OpenAI: class {
      constructor() {
        this.chat = {
          completions: {
            create: async () => ({
              choices: [{ message: { content: "[]" } }],
            }),
          },
        };
      }
    },
  });
  return {
    app: require(path.join(srcRoot, "app.js")),
    poolMock,
    firebaseAdmin,
  };
}

function signTestToken(payload = {}) {
  const claims = {
    uid: "test-user",
    email: "test@example.com",
    role: "admin",
    ...payload,
  };
  // Ghi uid vào sổ để middleware xác thực (đối chiếu DB) thấy user tồn tại.
  // role đăng ký đúng bằng role trong token để test giữ nguyên ngữ nghĩa cũ.
  testUserRegistry.set(claims.uid, { role: claims.role, is_active: true });
  // Phải ký kèm issuer/audience vì verifyAccessToken chốt cứng cả hai (chống
  // token từ hệ thống khác được chấp nhận) và khoá thuật toán ở HS256.
  return jwt.sign(
    { ...claims, type: "access" },
    process.env.JWT_SECRET || "test-secret-key-with-at-least-32-chars",
    {
      expiresIn: "1h",
      issuer: process.env.JWT_ISSUER || "online-learning-api",
      audience: process.env.JWT_AUDIENCE || "online-learning-client",
      algorithm: "HS256",
    }
  );
}

async function withServer(app, callback) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    return await callback({
      baseUrl,
      request: (url, options = {}) => fetch(`${baseUrl}${url}`, options),
      json: (url, options = {}) =>
        fetch(`${baseUrl}${url}`, {
          ...options,
          headers: {
            "content-type": "application/json",
            ...(options.headers || {}),
          },
          body:
            options.body && typeof options.body !== "string"
              ? JSON.stringify(options.body)
              : options.body,
        }),
    });
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
}

module.exports = {
  createFirebaseAdminMock,
  createPoolMock,
  loadApp,
  signTestToken,
  testUserRegistry,
  withServer,
};
