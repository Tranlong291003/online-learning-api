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

function loadApp(options = {}) {
  process.env.JWT_SECRET = options.jwtSecret || "test-secret-key-with-at-least-32-chars";
  process.env.NODE_ENV = "test";
  process.env.OPENAI_API_KEY = "test-openai-key";

  clearProjectModules();

  const poolMock = options.poolMock || createPoolMock();
  const firebaseAdmin = options.firebaseAdmin || createFirebaseAdminMock();

  mockModule(path.join(srcRoot, "config", "db.config.js"), { pool: poolMock.pool });
  mockModule(path.join(srcRoot, "config", "firebase.config.js"), firebaseAdmin);
  mockModule("firebase-admin", firebaseAdmin);
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
  return jwt.sign(
    {
      uid: "test-user",
      email: "test@example.com",
      role: "admin",
      ...payload,
    },
    process.env.JWT_SECRET || "test-secret-key-with-at-least-32-chars",
    { expiresIn: "1h" }
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
  withServer,
};
