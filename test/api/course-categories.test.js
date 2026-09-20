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

test("GET /api/course-categories returns categories with course counts", async () => {
  const poolMock = createPoolMock([
    {
      rows: [
        {
          category_id: 1,
          name: "JavaScript",
          description: "JS courses",
          course_count: "3",
        },
      ],
    },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ request }) => {
    const response = await request("/api/course-categories", {
      headers: authHeaders(),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.message, "Lấy danh mục cùng số lượng khóa học thành công");
    assert.equal(body.data[0].name, "JavaScript");
    assert.equal(body.data[0].course_count, "3");
  });
});

test("POST /api/course-categories/create creates a category", async () => {
  const poolMock = createPoolMock([
    { rows: [{ role: "admin" }] },
    { rows: [{ category_id: 5 }] },
    { rows: [{ fcm_token: null }] },
    { rows: [{ noti_id: 7 }] },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/course-categories/create", {
      method: "POST",
      headers: authHeaders(),
      body: { name: "Backend", description: "API courses", uid: "admin-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.message, "✅ Tạo danh mục thành công");
    // FE cần category_id của danh mục vừa tạo
    assert.equal(body.category_id, 5);
    assert.equal(body.notification.noti_id, 7);

    const inserts = poolMock.calls.filter((c) =>
      c.sql.trim().toLowerCase().startsWith("insert into course_categories")
    );
    assert.equal(inserts.length, 1);
    assert.match(inserts[0].sql, /RETURNING category_id/);
  });
});

test("POST /api/course-categories/create returns 400 when name is missing", async () => {
  const poolMock = createPoolMock([]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/course-categories/create", {
      method: "POST",
      headers: authHeaders(),
      body: { uid: "admin-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.ok(body.error);
    assert.equal(poolMock.calls.length, 0);
  });
});

test("POST /api/course-categories/create returns 403 for non mentor/admin", async () => {
  const poolMock = createPoolMock([{ rows: [{ role: "user" }] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/course-categories/create", {
      method: "POST",
      headers: authHeaders({ role: "user", uid: "student-1" }),
      body: { name: "Backend", uid: "student-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 403);
    assert.equal(body.error, "Bạn không có quyền tạo danh mục");
  });
});

test("PUT /api/course-categories/update/1 updates a category", async () => {
  const poolMock = createPoolMock([
    { rows: [{ role: "admin" }] },
    { rows: [{ category_id: 1, name: "Frontend", description: "UI courses", icon: null }] },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/course-categories/update/1", {
      method: "PUT",
      headers: authHeaders(),
      body: { name: "Frontend", description: "UI courses", uid: "admin-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.message, "✅ Cập nhật thành công");
    assert.equal(body.data.category_id, 1);

    const updates = poolMock.calls.filter((c) =>
      c.sql.trim().toLowerCase().startsWith("update course_categories")
    );
    assert.equal(updates.length, 1);
  });
});

test("PUT /api/course-categories/update/999 returns 404 when category missing", async () => {
  const poolMock = createPoolMock([
    { rows: [{ role: "admin" }] },
    { rows: [] },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/course-categories/update/999", {
      method: "PUT",
      headers: authHeaders(),
      body: { name: "Frontend", description: "UI courses", uid: "admin-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.error, "Không tìm thấy danh mục");
  });
});

test("PUT /api/course-categories/update/1 returns 400 when name is missing", async () => {
  const poolMock = createPoolMock([]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/course-categories/update/1", {
      method: "PUT",
      headers: authHeaders(),
      body: { uid: "admin-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.ok(body.error);
    assert.equal(poolMock.calls.length, 0);
  });
});

test("PUT /api/course-categories/update/1 returns 403 for non mentor/admin", async () => {
  const poolMock = createPoolMock([{ rows: [{ role: "user" }] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/course-categories/update/1", {
      method: "PUT",
      headers: authHeaders({ role: "user", uid: "student-1" }),
      body: { name: "Frontend", uid: "student-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 403);
    assert.equal(body.error, "Bạn không có quyền thay đổi danh mục");
  });
});

test("PUT /api/course-categories/update/1 returns 404 when user is not found", async () => {
  const poolMock = createPoolMock([{ rows: [] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/course-categories/update/1", {
      method: "PUT",
      headers: authHeaders(),
      body: { name: "Frontend", uid: "ghost-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.error, "Không tìm thấy người dùng");
  });
});

test("DELETE /api/course-categories/delete/1 deletes a category", async () => {
  const poolMock = createPoolMock([
    { rows: [{ role: "admin" }] },
    { rows: [{ category_id: 1 }] },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/course-categories/delete/1", {
      method: "DELETE",
      headers: authHeaders(),
      body: { uid: "admin-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.message, "🗑️ Xóa danh mục thành công");
  });
});

test("DELETE /api/course-categories/delete/1 uses token uid when body omits it (regression)", async () => {
  const poolMock = createPoolMock([
    { rows: [{ role: "admin" }] },
    { rows: [{ category_id: 1 }] },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/course-categories/delete/1", {
      method: "DELETE",
      headers: authHeaders({ uid: "admin-1", role: "admin" }),
      body: {},
    });

    // uid lấy từ token nên request vẫn được xử lý bình thường
    assert.equal(response.status, 200);
    const roleCall = poolMock.calls.find((c) =>
      c.sql.toLowerCase().includes("select role from users")
    );
    assert.ok(roleCall, "phải truy vấn role bằng uid lấy từ token");
    assert.equal(roleCall.params[0], "admin-1");
  });
});

test("DELETE /api/course-categories/delete/1 rejects spoofed uid (regression)", async () => {
  const poolMock = createPoolMock([]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/course-categories/delete/1", {
      method: "DELETE",
      headers: authHeaders({ uid: "student-1", role: "user" }),
      body: { uid: "admin-1" },
    });
    const body = await response.json();

    // user thường không được mạo danh uid của người khác
    assert.equal(response.status, 403);
    assert.ok(body.error);
    assert.equal(poolMock.calls.length, 0);
  });
});

test("DELETE /api/course-categories/delete/1 returns 403 for non mentor/admin", async () => {
  const poolMock = createPoolMock([{ rows: [{ role: "user" }] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/course-categories/delete/1", {
      method: "DELETE",
      headers: authHeaders({ role: "user", uid: "student-1" }),
      body: { uid: "student-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 403);
    assert.equal(body.error, "Bạn không có quyền xóa danh mục");
  });
});

test("DELETE /api/course-categories/delete/1 returns 404 when user is not found", async () => {
  const poolMock = createPoolMock([{ rows: [] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/course-categories/delete/1", {
      method: "DELETE",
      headers: authHeaders(),
      body: { uid: "ghost-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.error, "Không tìm thấy người dùng");
  });
});

test("DELETE /api/course-categories/delete/1 returns 409 on FK violation (23503)", async () => {
  const fkGuard = (sql) => {
    if (sql.toLowerCase().startsWith("delete from course_categories")) {
      const err = new Error("FK violation");
      err.code = "23503";
      throw err;
    }
    return { rows: [{ role: "admin" }] };
  };
  const poolMock = createPoolMock([fkGuard, fkGuard]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/course-categories/delete/1", {
      method: "DELETE",
      headers: authHeaders(),
      body: { uid: "admin-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 409);
    assert.equal(body.error, "Không thể xoá danh mục đang có khóa học");
  });
});
