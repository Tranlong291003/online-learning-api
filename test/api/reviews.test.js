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

test("POST /api/reviews/create returns 201 with review_id", async () => {
  // Controller kiểm tra khoá học tồn tại TRƯỚC khi insert (tránh vi phạm khoá
  // ngoại → 500). Nên thứ tự truy vấn là: courses → course_reviews → INSERT.
  const bySql = (sql) => {
    if (sql.includes("FROM courses")) return { rows: [{ course_id: 1 }] };
    if (sql.includes("SELECT 1 FROM course_reviews")) return { rows: [] };
    return { rows: [{ review_id: 42 }] };
  };
  const poolMock = createPoolMock([bySql, bySql, bySql]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/reviews/create", {
      method: "POST",
      headers: authHeaders(),
      body: { course_id: 1, user_uid: "user-1", rating: 5, comment: "Great" },
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.data.review_id, 42);
    const insert = poolMock.calls.find((c) => c.sql.includes("INSERT INTO course_reviews"));
    assert.ok(insert, "phải có INSERT vào course_reviews");
    assert.deepEqual(insert.params, [1, "user-1", 5, "Great"]);
  });
});

test("POST /api/reviews/create returns 404 when course does not exist (regression)", async () => {
  const poolMock = createPoolMock([{ rows: [] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/reviews/create", {
      method: "POST",
      headers: authHeaders(),
      body: { course_id: 999, user_uid: "user-1", rating: 5, comment: "Great" },
    });

    assert.equal(response.status, 404);
    // Không được chạm tới INSERT
    assert.ok(!poolMock.calls.some((c) => c.sql.includes("INSERT INTO course_reviews")));
  });
});

test("POST /api/reviews/create returns 400 when required fields are missing", async () => {
  const poolMock = createPoolMock();
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/reviews/create", {
      method: "POST",
      headers: authHeaders(),
      body: { course_id: 1 },
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.match(body.error, /course_id và rating/);
    assert.equal(poolMock.calls.length, 0);
  });
});

test("POST /api/reviews/create returns 400 when rating out of range (regression)", async () => {
  const poolMock = createPoolMock();
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/reviews/create", {
      method: "POST",
      headers: authHeaders(),
      body: { course_id: 1, rating: 9 },
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.match(body.error, /rating/);
    assert.equal(poolMock.calls.length, 0);
  });
});

test("POST /api/reviews/create returns 400 when user already reviewed", async () => {
  // createPoolMock lấy phần tử theo HÀNG ĐỢI (shift), nên hàm phải được truyền
  // cho từng vị trí truy vấn: 1) kiểm tra courses, 2) kiểm tra trùng review.
  const bySql = (sql) => {
    if (sql.includes("FROM courses")) return { rows: [{ course_id: 1 }] };
    if (sql.includes("SELECT 1 FROM course_reviews")) return { rows: [{ 1: 1 }] };
    return { rows: [] };
  };
  const poolMock = createPoolMock([bySql, bySql]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/reviews/create", {
      method: "POST",
      headers: authHeaders(),
      body: { course_id: 1, user_uid: "user-1", rating: 4 },
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.match(body.error, /đã review/);
    assert.ok(!poolMock.calls.some((c) => c.sql.includes("INSERT INTO course_reviews")));
  });
});

test("GET /api/reviews/course/1 returns 200 with review list", async () => {
  const poolMock = createPoolMock([
    {
      rows: [
        {
          review_id: 1,
          course_id: 1,
          user_uid: "user-1",
          user_name: "User One",
          rating: 5,
          comment: "Nice",
        },
      ],
    },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ request }) => {
    const response = await request("/api/reviews/course/1", {
      headers: authHeaders(),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].user_name, "User One");
    // courseId được ép về số trước khi query
    assert.deepEqual(poolMock.calls[0].params, [1]);
  });
});

test("GET /api/reviews/course/1 returns 500 on database error without leaking internals", async () => {
  const poolMock = createPoolMock([
    () => {
      throw new Error("db down at 10.0.0.5:5432 user=postgres");
    },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ request }) => {
    const response = await request("/api/reviews/course/1", {
      headers: authHeaders(),
    });
    const body = await response.json();

    assert.equal(response.status, 500);
    // Trường `error` là thông báo an toàn, KHÔNG chứa chi tiết nội bộ — trước
    // đây controller nối thẳng err.message vào đây nên lộ host/port/user của DB.
    assert.equal(body.error, "Lỗi server");
    assert.doesNotMatch(body.error, /10\.0\.0\.5|postgres/);
    // Ngoài production, chi tiết nằm riêng ở `detail` để còn debug.
    assert.match(body.detail, /db down/);
  });
});

test("PUT /api/reviews/update/1 returns 200 and updates rating", async () => {
  const poolMock = createPoolMock([
    (sql) =>
      sql.includes("SELECT user_uid FROM course_reviews")
        ? { rows: [{ user_uid: "user-1" }] }
        : { rows: [] },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/reviews/update/1", {
      method: "PUT",
      headers: authHeaders(),
      body: { user_uid: "user-1", rating: 4 },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.match(body.message, /Cập nhật thành công/);
    assert.equal(poolMock.calls.length, 2);
    assert.ok(poolMock.calls[1].sql.includes("UPDATE course_reviews SET"));
    // parsePositiveInt ép reviewId về SỐ trước khi truyền vào câu SQL.
    assert.deepEqual(poolMock.calls[1].params, [4, 1]);
  });
});

test("PUT /api/reviews/update/1 uses token uid when body omits it (regression)", async () => {
  const poolMock = createPoolMock([
    { rows: [{ user_uid: "user-1" }] },
    { rows: [{ review_id: 1 }] },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/reviews/update/1", {
      method: "PUT",
      headers: authHeaders({ uid: "user-1", role: "user" }),
      body: { rating: 4 },
    });

    assert.equal(response.status, 200);
    const call = poolMock.calls.find((c) =>
      c.sql.toLowerCase().includes("select user_uid from course_reviews")
    );
    assert.ok(call, "phải kiểm tra chủ sở hữu bằng uid lấy từ token");
  });
});

test("PUT /api/reviews/update/1 rejects spoofed user_uid (regression)", async () => {
  const poolMock = createPoolMock();
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/reviews/update/1", {
      method: "PUT",
      headers: authHeaders({ uid: "student-1", role: "user" }),
      body: { rating: 4, user_uid: "someone-else" },
    });

    assert.equal(response.status, 403);
    assert.equal(poolMock.calls.length, 0);
  });
});

test("PUT /api/reviews/update/1 returns 400 when no fields to update", async () => {
  const poolMock = createPoolMock();
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/reviews/update/1", {
      method: "PUT",
      headers: authHeaders(),
      body: { user_uid: "user-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.match(body.error, /Không có dữ liệu để cập nhật/);
    assert.equal(poolMock.calls.length, 0);
  });
});

test("PUT /api/reviews/update/1 returns 403 when review belongs to another user", async () => {
  const poolMock = createPoolMock([
    { rows: [{ user_uid: "someone-else" }] },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/reviews/update/1", {
      method: "PUT",
      headers: authHeaders(),
      body: { user_uid: "user-1", rating: 3 },
    });
    const body = await response.json();

    assert.equal(response.status, 403);
    assert.match(body.error, /không có quyền cập nhật/);
    assert.equal(poolMock.calls.length, 1);
  });
});

test("PUT /api/reviews/update/1 returns 404 when review not found", async () => {
  const poolMock = createPoolMock([{ rows: [] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/reviews/update/1", {
      method: "PUT",
      headers: authHeaders(),
      body: { user_uid: "user-1", rating: 3 },
    });
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.match(body.error, /Không tìm thấy review/);
  });
});

test("DELETE /api/reviews/delete/1 returns 200 when owner deletes", async () => {
  const poolMock = createPoolMock([
    (sql) =>
      sql.includes("SELECT user_uid FROM course_reviews")
        ? { rows: [{ user_uid: "user-1" }] }
        : { rows: [] },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/reviews/delete/1", {
      method: "DELETE",
      headers: authHeaders(),
      body: { user_uid: "user-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.match(body.message, /Xóa thành công/);
    assert.ok(poolMock.calls[1].sql.includes("DELETE FROM course_reviews"));
    assert.deepEqual(poolMock.calls[1].params, [1]);
  });
});

test("DELETE /api/reviews/delete/1 rejects spoofed user_uid (regression)", async () => {
  const poolMock = createPoolMock();
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/reviews/delete/1", {
      method: "DELETE",
      headers: authHeaders({ uid: "student-1", role: "user" }),
      body: { user_uid: "someone-else" },
    });

    assert.equal(response.status, 403);
    assert.equal(poolMock.calls.length, 0);
  });
});

test("DELETE /api/reviews/delete/1 returns 403 when review belongs to another user", async () => {
  const poolMock = createPoolMock([
    { rows: [{ user_uid: "someone-else" }] },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/reviews/delete/1", {
      method: "DELETE",
      headers: authHeaders(),
      body: { user_uid: "user-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 403);
    assert.match(body.error, /không có quyền xóa/);
  });
});

test("DELETE /api/reviews/delete/1 returns 404 when review not found", async () => {
  const poolMock = createPoolMock([{ rows: [] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/reviews/delete/1", {
      method: "DELETE",
      headers: authHeaders(),
      body: { user_uid: "user-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.match(body.error, /Không tìm thấy review/);
  });
});
