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

function sqlMock(fn, calls = 20) {
  return Array.from({ length: calls }, () => fn);
}

test("GET /api/lessons/courses/1/user-1 returns lesson list", async () => {
  const poolMock = createPoolMock(sqlMock((sql) => {
      const q = sql.toLowerCase();
      if (q.includes("from lessons as l")) {
        return {
          rows: [
            { lesson_id: 1, course_id: 1, title: "Lesson 1", is_completed: 0 },
            { lesson_id: 2, course_id: 1, title: "Lesson 2", is_completed: 1 },
          ],
        };
      }
      return { rows: [] };
    }));
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ request }) => {
    const response = await request("/api/lessons/courses/1/user-1", {
      headers: authHeaders(),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.message, "Lấy danh sách bài học thành công");
    assert.equal(body.data.length, 2);
    assert.equal(body.data[1].is_completed, 1);
  });
});

test("GET /api/lessons/courses/abc/user-1 returns 400", async () => {
  const { app } = loadApp();

  await withServer(app, async ({ request }) => {
    const response = await request("/api/lessons/courses/abc/user-1", {
      headers: authHeaders(),
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error, "Tham số course_id không hợp lệ");
  });
});

test("GET /api/lessons/detail/1 returns lesson detail", async () => {
  const poolMock = createPoolMock([
    { rows: [{ lesson_id: 1, title: "Lesson 1", course_id: 1 }] },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ request }) => {
    const response = await request("/api/lessons/detail/1", {
      headers: authHeaders(),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.message, "Lấy chi tiết bài học thành công");
    assert.equal(body.data.lesson_id, 1);
  });
});

test("GET /api/lessons/detail/999 returns 404", async () => {
  const poolMock = createPoolMock([{ rows: [] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ request }) => {
    const response = await request("/api/lessons/detail/999", {
      headers: authHeaders(),
    });
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.error, "Không tìm thấy bài học này");
  });
});

test("POST /api/lessons/create returns 201 without video_url", async () => {
  const poolMock = createPoolMock(sqlMock((sql) => {
      const q = sql.toLowerCase();
      if (q.includes("select role from users")) {
        return { rows: [{ role: "admin" }] };
      }
      if (q.includes("select course_id from courses")) {
        return { rows: [{ course_id: 1 }] };
      }
      if (q.includes("insert into lessons")) {
        return { rows: [{ lesson_id: 9, title: "Lesson 9", course_id: 1 }] };
      }
      return { rows: [] };
    }));
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/lessons/create", {
      method: "POST",
      headers: authHeaders(),
      body: { course_id: 1, title: "Lesson 9", uid: "admin-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.message, "Tạo bài học thành công");
    assert.equal(body.data.lesson_id, 9);
  });
});

test("POST /api/lessons/create returns 400 when fields missing", async () => {
  const { app } = loadApp();

  await withServer(app, async ({ json }) => {
    const response = await json("/api/lessons/create", {
      method: "POST",
      headers: authHeaders(),
      body: { course_id: 1 },
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(
      body.error,
      "Các trường course_id và title là bắt buộc"
    );
  });
});

test("POST /api/lessons/create returns 403 for user role", async () => {
  const poolMock = createPoolMock(sqlMock((sql) => {
      const q = sql.toLowerCase();
      if (q.includes("select role from users")) {
        return { rows: [{ role: "user" }] };
      }
      return { rows: [] };
    }));
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/lessons/create", {
      method: "POST",
      headers: authHeaders({ role: "user", uid: "student-1" }),
      body: { course_id: 1, title: "Lesson", uid: "student-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 403);
    assert.equal(body.error, "Bạn không có quyền tạo bài học");
  });
});

test("POST /api/lessons/create returns 404 when course missing", async () => {
  const poolMock = createPoolMock(sqlMock((sql) => {
      const q = sql.toLowerCase();
      if (q.includes("select role from users")) {
        return { rows: [{ role: "admin" }] };
      }
      if (q.includes("select course_id from courses")) return { rows: [] };
      return { rows: [] };
    }));
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/lessons/create", {
      method: "POST",
      headers: authHeaders(),
      body: { course_id: 999, title: "Lesson", uid: "admin-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.error, "Không tìm thấy khóa học");
  });
});

test("PUT /api/lessons/update/1 returns 200", async () => {
  const poolMock = createPoolMock(sqlMock((sql) => {
      const q = sql.toLowerCase();
      if (q.includes("select role from users")) {
        return { rows: [{ role: "admin" }] };
      }
      if (q.includes("select * from lessons")) {
        return {
          rows: [
            {
              lesson_id: 1,
              title: "Old title",
              video_url: null,
              pdf_url: null,
              slide_url: null,
              content: null,
              order: 1,
            },
          ],
        };
      }
      if (q.includes("update lessons")) {
        return { rows: [{ lesson_id: 1, title: "New title" }] };
      }
      return { rows: [] };
    }));
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/lessons/update/1", {
      method: "PUT",
      headers: authHeaders(),
      body: { title: "New title", uid: "admin-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.message, "Cập nhật bài học thành công");
    assert.equal(body.data.title, "New title");
  });
});

test("PUT /api/lessons/update/1 rejects spoofed uid (regression)", async () => {
  const poolMock = createPoolMock([]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/lessons/update/1", {
      method: "PUT",
      headers: authHeaders({ uid: "student-1", role: "user" }),
      body: { title: "New title", uid: "admin-1" },
    });

    assert.equal(response.status, 403);
    assert.equal(poolMock.calls.length, 0);
  });
});

test("PUT /api/lessons/update/1 returns 403 for user role", async () => {
  const poolMock = createPoolMock(sqlMock((sql) => {
      const q = sql.toLowerCase();
      if (q.includes("select role from users")) {
        return { rows: [{ role: "user" }] };
      }
      return { rows: [] };
    }));
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/lessons/update/1", {
      method: "PUT",
      headers: authHeaders({ role: "user", uid: "student-1" }),
      body: { title: "Hack", uid: "student-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 403);
    assert.equal(body.error, "Bạn không có quyền cập nhật bài học");
  });
});

test("PUT /api/lessons/update/999 returns 404 when lesson missing", async () => {
  const poolMock = createPoolMock(sqlMock((sql) => {
      const q = sql.toLowerCase();
      if (q.includes("select role from users")) {
        return { rows: [{ role: "admin" }] };
      }
      if (q.includes("select * from lessons")) return { rows: [] };
      return { rows: [] };
    }));
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/lessons/update/999", {
      method: "PUT",
      headers: authHeaders(),
      body: { title: "New title", uid: "admin-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.error, "Không tìm thấy bài học");
  });
});

test("DELETE /api/lessons/delete/1 returns 200 for admin", async () => {
  const poolMock = createPoolMock(sqlMock((sql) => {
      const q = sql.toLowerCase();
      if (q.includes("select role from users")) {
        return { rows: [{ role: "admin" }] };
      }
      if (q.includes("select lesson_id, pdf_url")) {
        return {
          rows: [
            {
              lesson_id: 1,
              pdf_url: null,
              slide_url: null,
              creator_uid: "mentor-1",
            },
          ],
        };
      }
      return { rows: [] };
    }));
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/lessons/delete/1", {
      method: "DELETE",
      headers: authHeaders(),
      body: { uid: "admin-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.message, "Xoá bài học thành công");
  });
});

test("DELETE /api/lessons/delete/1 returns 403 for non-owner mentor", async () => {
  const poolMock = createPoolMock(sqlMock((sql) => {
      const q = sql.toLowerCase();
      if (q.includes("select role from users")) {
        return { rows: [{ role: "mentor" }] };
      }
      if (q.includes("select lesson_id, pdf_url")) {
        return {
          rows: [
            {
              lesson_id: 1,
              pdf_url: null,
              slide_url: null,
              creator_uid: "other-mentor",
            },
          ],
        };
      }
      return { rows: [] };
    }));
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/lessons/delete/1", {
      method: "DELETE",
      headers: authHeaders({ role: "mentor", uid: "mentor-1" }),
      body: { uid: "mentor-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 403);
    assert.equal(body.error, "Bạn chỉ được xoá bài học do bạn tạo");
  });
});

test("DELETE /api/lessons/delete/1 returns 403 for student role", async () => {
  const poolMock = createPoolMock(sqlMock((sql) => {
      const q = sql.toLowerCase();
      if (q.includes("select role from users")) {
        return { rows: [{ role: "user" }] };
      }
      if (q.includes("select lesson_id, pdf_url")) {
        return {
          rows: [
            {
              lesson_id: 1,
              pdf_url: null,
              slide_url: null,
              creator_uid: "mentor-1",
            },
          ],
        };
      }
      return { rows: [] };
    }));
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/lessons/delete/1", {
      method: "DELETE",
      headers: authHeaders({ role: "user", uid: "student-1" }),
      body: { uid: "student-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 403);
    // Quy tắc "chỉ admin/mentor" giờ chặn ngay ở route (authorize), nên học viên
    // bị từ chối trước khi controller kịp truy vấn DB. Vẫn là 403 và không có
    // truy vấn nào chạy — bảo vệ còn chặt hơn trước.
    assert.equal(body.error, "Bạn không có quyền xóa bài học");
    assert.equal(poolMock.calls.length, 0);
  });
});

test("DELETE /api/lessons/delete/999 returns 404", async () => {
  const poolMock = createPoolMock(sqlMock((sql) => {
      const q = sql.toLowerCase();
      if (q.includes("select role from users")) {
        return { rows: [{ role: "admin" }] };
      }
      if (q.includes("select lesson_id, pdf_url")) return { rows: [] };
      return { rows: [] };
    }));
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/lessons/delete/999", {
      method: "DELETE",
      headers: authHeaders(),
      body: { uid: "admin-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.error, "Không tìm thấy bài học để xoá");
  });
});

test("POST /api/lessons/complete returns 200 with insert status", async () => {
  const poolMock = createPoolMock(sqlMock((sql) => {
      const q = sql.toLowerCase();
      if (q.includes("select 1 from lessons")) {
        return { rows: [{ exists: 1 }] };
      }
      if (q.includes("select 1 from enrollments")) {
        return { rows: [{ exists: 1 }] };
      }
      if (q.includes("insert into lesson_progress")) {
        return { rows: [{ action: "INSERT" }] };
      }
      return { rows: [] };
    }));
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/lessons/complete", {
      method: "POST",
      headers: authHeaders(),
      body: { userUid: "user-1", courseId: 1, lessonId: 5 },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.status, "insert");
    assert.equal(body.message, "Hoàn thành bài học (lần đầu)");
  });
});

test("POST /api/lessons/complete dùng đúng ON CONFLICT target của DB thật", async () => {
  // DB thật chỉ có unique (user_uid, course_id, lesson_id) và lesson_progress
  // KHÔNG có cột created_at. Sai target -> lỗi 42P10; cột lạ -> 42703.
  const completeSql = sqlMock((sql) => {
    const q = sql.toLowerCase();
    if (q.includes("select 1 from lessons")) return { rows: [{ exists: 1 }] };
    if (q.includes("select 1 from enrollments")) return { rows: [{ exists: 1 }] };
    if (q.includes("insert into lesson_progress")) return { rows: [{ action: "INSERT" }] };
    return { rows: [] };
  });
  const poolMock = createPoolMock(completeSql);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/lessons/complete", {
      method: "POST",
      headers: authHeaders(),
      body: { userUid: "user-1", courseId: 1, lessonId: 5 },
    });
    assert.equal(response.status, 200);
  });

  const insert = poolMock.calls.find((c) => /insert into lesson_progress/i.test(c.sql));
  assert.ok(insert, "phải có câu INSERT lesson_progress");
  assert.match(insert.sql, /ON CONFLICT \(user_uid, course_id, lesson_id\)/i);
  assert.doesNotMatch(insert.sql, /created_at/i, "lesson_progress không có cột created_at");
});

test("POST /api/lessons/complete returns 400 when fields missing", async () => {
  const { app } = loadApp();

  await withServer(app, async ({ json }) => {
    const response = await json("/api/lessons/complete", {
      method: "POST",
      headers: authHeaders(),
      body: { userUid: "user-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error, "Thiếu courseId hoặc lessonId");
  });
});

test("POST /api/lessons/complete ignores a spoofed userUid for a non-admin", async () => {
  const poolMock = createPoolMock();
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/lessons/complete", {
      method: "POST",
      headers: authHeaders({ uid: "user-1", role: "user" }),
      body: { userUid: "victim-2", courseId: 1, lessonId: 5 },
    });

    assert.equal(response.status, 403);
    assert.equal(poolMock.calls.length, 0);
  });
});

test("POST /api/lessons/complete returns 403 when not enrolled", async () => {
  const poolMock = createPoolMock(sqlMock((sql) => {
      const q = sql.toLowerCase();
      if (q.includes("select 1 from lessons")) {
        return { rows: [{ exists: 1 }] };
      }
      if (q.includes("select 1 from enrollments")) return { rows: [] };
      return { rows: [] };
    }));
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/lessons/complete", {
      method: "POST",
      headers: authHeaders(),
      body: { userUid: "user-1", courseId: 1, lessonId: 5 },
    });
    const body = await response.json();

    assert.equal(response.status, 403);
    assert.equal(body.error, "Chưa ghi danh khóa học");
  });
});

test("POST /api/lessons/complete returns 404 when lesson missing", async () => {
  const poolMock = createPoolMock(sqlMock((sql) => {
      const q = sql.toLowerCase();
      if (q.includes("select 1 from lessons")) return { rows: [] };
      return { rows: [] };
    }));
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/lessons/complete", {
      method: "POST",
      headers: authHeaders(),
      body: { userUid: "user-1", courseId: 1, lessonId: 999 },
    });
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.error, "Bài học không thuộc khóa học này");
  });
});
