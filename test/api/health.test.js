const test = require("node:test");
const assert = require("node:assert/strict");
const { loadApp, withServer } = require("../helpers/apiTestUtils");

test("GET /health returns API status", async () => {
  const { app } = loadApp();

  await withServer(app, async ({ request }) => {
    const response = await request("/health");
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.status, "ok");
    assert.match(body.timestamp, /^\d{4}-\d{2}-\d{2}T/);
  });
});
