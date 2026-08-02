const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { loadApp, withServer } = require("../helpers/apiTestUtils");

const srcRoot = path.resolve(__dirname, "..", "..", "src");
const DEV_KEY = "dev-test-key";

test("DEV_API_KEY: request with x-dev-api-key header bypasses JWT", async () => {
  process.env.DEV_API_KEY = DEV_KEY;
  const { app } = loadApp();

  await withServer(app, async ({ request }) => {
    const response = await request("/api/course-categories", {
      headers: { "x-dev-api-key": DEV_KEY },
    });

    assert.notEqual(response.status, 401, "should not be blocked by auth");
    assert.notEqual(response.status, 500, "should not hit server error");
  });
});

test("DEV_API_KEY: missing header still returns 401", async () => {
  process.env.DEV_API_KEY = DEV_KEY;
  const { app } = loadApp();

  await withServer(app, async ({ request }) => {
    const response = await request("/api/course-categories");
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.error, "Token không hợp lệ");
  });
});

test("DEV_API_KEY: accepted via Authorization: Bearer header too", async () => {
  process.env.DEV_API_KEY = DEV_KEY;
  const { app } = loadApp();

  await withServer(app, async ({ request }) => {
    const response = await request("/api/course-categories", {
      headers: { authorization: `Bearer ${DEV_KEY}` },
    });

    assert.notEqual(response.status, 401, "should not be blocked by auth");
    assert.notEqual(response.status, 500, "should not hit server error");
  });
});

test("DEV_API_KEY: wrong key still rejected with 401", async () => {
  process.env.DEV_API_KEY = DEV_KEY;
  const { app } = loadApp();

  await withServer(app, async ({ request }) => {
    const response = await request("/api/course-categories", {
      headers: { "x-dev-api-key": "wrong-key" },
    });
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.error, "Token không hợp lệ");
  });
});

test("DEV_API_KEY: disabled when NODE_ENV=production", async () => {
  const middlewarePath = require.resolve(
    path.join(srcRoot, "middleware", "auth.middleware.js")
  );
  delete require.cache[middlewarePath];

  process.env.DEV_API_KEY = DEV_KEY;
  process.env.NODE_ENV = "production";

  const authMiddleware = require(middlewarePath);

  await new Promise((resolve, reject) => {
    const req = { headers: { "x-dev-api-key": DEV_KEY } };
    const res = {
      status: (code) => {
        assert.equal(code, 401, "dev key must be rejected in production");
        return {
          json: (body) => {
            assert.equal(body.error, "Token không hợp lệ");
            resolve();
          },
        };
      },
    };
    authMiddleware(req, res, () =>
      reject(new Error("next() should not be called in production"))
    );
  });
});
