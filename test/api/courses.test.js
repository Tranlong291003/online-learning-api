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

test("GET /api/courses/ returns grouped courses with total", async () => {
  const poolMock = createPoolMock(sqlMock((sql) => {
      const q = sql.toLowerCase();
      if (q.includes("from courses")) {
        return {
          rows: [
            {
              course_id: 1,
              title: "Pending course",
              status: "pending",
              total_seconds: 3661,
              lesson_count: 2,
            },
            {
              course_id: 2,
              title: "Approved course",
              status: "approved",
              total_seconds: null,
              lesson_count: 0,
            },
          ],
        };
      }
      return { rows: [] };
    }));
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ request }) => {
    const response = await request("/api/courses/", {
      headers: authHeaders(),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.total, 2);
    assert.equal(body.data.pending.length, 1);
    assert.equal(body.data.approved.length, 1);
    assert.equal(body.data.rejected.length, 0);
    assert.equal(body.data.pending[0].total_duration, "01:01:01");
  });
});

test("GET /api/courses/ returns message when no courses", async () => {
  const poolMock = createPoolMock([{ rows: [] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ request }) => {
    const response = await request("/api/courses/", {
      headers: authHeaders(),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.message, "Không có khóa học");
  });
});

test("GET /api/courses/1 returns course detail with discount_percent", async () => {
  const poolMock = createPoolMock(sqlMock((sql) => {
      const q = sql.toLowerCase();
      if (q.includes("from courses c")) {
        return {
          rows: [
            {
              course_id: 1,
              title: "Course 1",
              price: 100,
              discount_price: 80,
              updated_at: "2026-01-02T00:00:00.000Z",
              last_lesson_update: null,
            },
          ],
        };
      }
      return { rows: [] };
    }));
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ request }) => {
    const response = await request("/api/courses/1", {
      headers: authHeaders(),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.data.course_id, 1);
    assert.equal(body.data.discount_percent, 20);
  });
});

test("GET /api/courses/1 returns 404 when course missing", async () => {
  const poolMock = createPoolMock([{ rows: [] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ request }) => {
    const response = await request("/api/courses/999", {
      headers: authHeaders(),
    });
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.error, "Không tìm thấy khóa học");
  });
});

test("GET /api/courses/mentor/mentor-1 returns mentor courses", async () => {
  const poolMock = createPoolMock(sqlMock((sql) => {
      const q = sql.toLowerCase();
      if (q.includes("where c.instructor_uid")) {
        return {
          rows: [
            {
              course_id: 1,
              title: "Mentor course",
              status: "approved",
              total_seconds: null,
              lesson_count: 1,
              price: 50,
              discount_price: null,
            },
          ],
        };
      }
      return { rows: [] };
    }));
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ request }) => {
    const response = await request("/api/courses/mentor/mentor-1", {
      headers: authHeaders(),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.total, 1);
    assert.equal(body.data.approved[0].title, "Mentor course");
  });
});

test("GET /api/courses/mentor/ returns 400 for missing param", async () => {
  const { app } = loadApp({ poolMock: createPoolMock() });

  await withServer(app, async ({ request }) => {
    const response = await request("/api/courses/mentor/%ZZ", {
      headers: authHeaders(),
    });

    assert.equal(response.status, 400);
  });
});

test("POST /api/courses/create returns 201 for mentor", async () => {
  const poolMock = createPoolMock(sqlMock((sql) => {
      const q = sql.toLowerCase();
      if (q.includes("select name, role from users")) {
        return { rows: [{ name: "Mentor A", role: "mentor" }] };
      }
      if (q.includes("insert into courses")) {
        return { rows: [{ course_id: 1, title: "New course", status: "pending" }] };
      }
      return { rows: [] };
    }));
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/courses/create", {
      method: "POST",
      headers: authHeaders({ role: "mentor", uid: "mentor-1" }),
      body: {
        title: "New course",
        category_id: 1,
        level: "beginner",
        uid: "mentor-1",
      },
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.message, "Tạo khóa học mới thành công");
    assert.equal(body.course.course_id, 1);
    assert.equal(body.course.instructor_name, "Mentor A");
  });
});

test("POST /api/courses/create returns 400 when title missing", async () => {
  const { app } = loadApp();

  await withServer(app, async ({ json }) => {
    const response = await json("/api/courses/create", {
      method: "POST",
      headers: authHeaders(),
      body: { uid: "mentor-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error, "Tên và danh mục là bắt buộc");
  });
});

test("POST /api/courses/create returns 403 when role is user", async () => {
  const poolMock = createPoolMock(sqlMock((sql) => {
      const q = sql.toLowerCase();
      if (q.includes("select name, role from users")) {
        return { rows: [{ name: "Student", role: "user" }] };
      }
      return { rows: [] };
    }));
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/courses/create", {
      method: "POST",
      headers: authHeaders({ role: "user", uid: "student-1" }),
      body: {
        title: "New course",
        category_id: 1,
        level: "beginner",
        uid: "student-1",
      },
    });
    const body = await response.json();

    assert.equal(response.status, 403);
    assert.equal(body.error, "Bạn không có quyền tạo khóa học");
  });
});

test("POST /api/courses/create returns 404 when user not found", async () => {
  const poolMock = createPoolMock(sqlMock((sql) => {
      const q = sql.toLowerCase();
      if (q.includes("select name, role from users")) return { rows: [] };
      return { rows: [] };
    }));
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/courses/create", {
      method: "POST",
      headers: authHeaders({ role: "mentor", uid: "ghost" }),
      body: {
        title: "New course",
        category_id: 1,
        level: "beginner",
        uid: "ghost",
      },
    });
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.error, "Không tìm thấy người dùng");
  });
});

test("POST /api/courses/create keeps price 0 in INSERT params", async () => {
  const poolMock = createPoolMock(sqlMock((sql) => {
      const q = sql.toLowerCase();
      if (q.includes("select name, role from users")) {
        return { rows: [{ name: "Mentor A", role: "mentor" }] };
      }
      if (q.includes("insert into courses")) {
        return { rows: [{ course_id: 1, title: "Free course" }] };
      }
      return { rows: [] };
    }));
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/courses/create", {
      method: "POST",
      headers: authHeaders({ role: "mentor", uid: "mentor-1" }),
      body: {
        title: "Free course",
        category_id: 1,
        level: "beginner",
        uid: "mentor-1",
        price: 0,
        discount_price: 0,
      },
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.course.course_id, 1);
    const insertCall = poolMock.calls.find((c) =>
      c.sql.toLowerCase().includes("insert into courses")
    );
    assert.ok(insertCall, "expected an INSERT INTO courses query");
    assert.equal(insertCall.params[5], 0, "price param must be 0, not null");
    assert.equal(insertCall.params[6], 0, "discount_price param must be 0, not null");
  });
});

test("PUT /api/courses/update/1 returns 200 for admin", async () => {
  const poolMock = createPoolMock(sqlMock((sql) => {
      const q = sql.toLowerCase();
      if (q.includes("select role from users")) {
        return { rows: [{ role: "admin" }] };
      }
      if (q.includes("select * from courses")) {
        return {
          rows: [
            {
              course_id: 1,
              title: "Old title",
              description: null,
              level: null,
              price: 10,
              discount_price: null,
              language: null,
              tags: null,
              thumbnail_url: null,
            },
          ],
        };
      }
      if (q.includes("update courses")) {
        return { rows: [{ course_id: 1, title: "New title" }] };
      }
      return { rows: [] };
    }));
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/courses/update/1", {
      method: "PUT",
      headers: authHeaders(),
      body: { title: "New title", uid: "admin-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.message, "Cập nhật khóa học thành công");
    assert.equal(body.data.title, "New title");
  });
});

test("PUT /api/courses/update/1 returns 403 for user role", async () => {
  const poolMock = createPoolMock(sqlMock((sql) => {
      const q = sql.toLowerCase();
      if (q.includes("select role from users")) {
        return { rows: [{ role: "user" }] };
      }
      return { rows: [] };
    }));
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/courses/update/1", {
      method: "PUT",
      headers: authHeaders({ role: "user", uid: "student-1" }),
      body: { title: "Hack", uid: "student-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 403);
    assert.equal(body.error, "Bạn không có quyền sửa khóa học");
  });
});

test("PUT /api/courses/update/1 returns 403 when mentor edits another mentor's course", async () => {
  const poolMock = createPoolMock(sqlMock((sql) => {
    const q = sql.toLowerCase();
    if (q.includes("select role from users")) {
      return { rows: [{ role: "mentor" }] };
    }
    if (q.includes("select * from courses")) {
      return { rows: [{ course_id: 1, title: "Other", instructor_uid: "other-mentor" }] };
    }
    return { rows: [] };
  }));
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/courses/update/1", {
      method: "PUT",
      headers: authHeaders({ role: "mentor", uid: "mentor-1" }),
      body: { title: "Hack", uid: "mentor-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 403);
    assert.match(body.error, /khóa học của người khác/);
  });
});

test("PUT /api/courses/update/1 returns 404 when course missing", async () => {
  const poolMock = createPoolMock(sqlMock((sql) => {
      const q = sql.toLowerCase();
      if (q.includes("select role from users")) {
        return { rows: [{ role: "admin" }] };
      }
      if (q.includes("select * from courses")) return { rows: [] };
      return { rows: [] };
    }));
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/courses/update/999", {
      method: "PUT",
      headers: authHeaders(),
      body: { title: "New title", uid: "admin-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.error, "Không tìm thấy khóa học");
  });
});

test("PATCH /api/courses/1/status returns 200 and sends notification", async () => {
  const poolMock = createPoolMock(sqlMock((sql) => {
      const q = sql.toLowerCase();
      if (q.includes("select role from users")) {
        return { rows: [{ role: "admin" }] };
      }
      if (q.includes("c.title, c.instructor_uid, c.status")) {
        return {
          rows: [
            {
              title: "Course A",
              instructor_uid: "mentor-1",
              status: "pending",
              fcm_token: "fcm-token-1",
              instructor_name: "Mentor A",
            },
          ],
        };
      }
      if (q.includes("update courses")) {
        return { rows: [{ course_id: 1, status: "approved" }] };
      }
      if (q.includes("insert into notifications")) {
        return { rows: [{ noti_id: 9 }] };
      }
      return { rows: [] };
    }));
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/courses/1/status", {
      method: "PATCH",
      headers: authHeaders(),
      body: { status: "approved", uid: "admin-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.message, "Cập nhật trạng thái khóa học thành công");
    assert.equal(body.data.status, "approved");
    assert.equal(body.data.fcm_sent, true);
  });
});

test("PATCH /api/courses/1/status returns 400 when status missing", async () => {
  const { app } = loadApp();

  await withServer(app, async ({ json }) => {
    const response = await json("/api/courses/1/status", {
      method: "PATCH",
      headers: authHeaders(),
      body: {},
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error, "Thiếu trạng thái");
  });
});

test("PATCH /api/courses/1/status rejects spoofed uid (regression)", async () => {
  const poolMock = createPoolMock([]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/courses/1/status", {
      method: "PATCH",
      headers: authHeaders({ uid: "student-1", role: "user" }),
      body: { status: "approved", uid: "admin-1" },
    });

    assert.equal(response.status, 403);
    assert.equal(poolMock.calls.length, 0);
  });
});

test("PATCH /api/courses/1/status returns 403 for user role", async () => {
  const poolMock = createPoolMock(sqlMock((sql) => {
      const q = sql.toLowerCase();
      if (q.includes("select role from users")) {
        return { rows: [{ role: "user" }] };
      }
      if (q.includes("c.title, c.instructor_uid, c.status")) {
        return {
          rows: [
            {
              title: "Course A",
              instructor_uid: "mentor-1",
              status: "pending",
              fcm_token: null,
              instructor_name: "Mentor A",
            },
          ],
        };
      }
      return { rows: [] };
    }));
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/courses/1/status", {
      method: "PATCH",
      headers: authHeaders({ role: "user", uid: "student-1" }),
      body: { status: "approved", uid: "student-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 403);
    assert.equal(body.error, "Bạn không có quyền cập nhật trạng thái khóa học");
  });
});

test("DELETE /api/courses/delete/1 returns 200 for admin", async () => {
  const poolMock = createPoolMock(sqlMock((sql) => {
      const q = sql.toLowerCase();
      if (q.includes("select role from users")) {
        return { rows: [{ role: "admin" }] };
      }
      if (q.includes("select instructor_uid from courses")) {
        return { rows: [{ instructor_uid: "admin-1" }] };
      }
      return { rows: [] };
    }));
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/courses/delete/1", {
      method: "DELETE",
      headers: authHeaders(),
      body: { uid: "admin-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.ok(
      poolMock.calls.some((c) => c.sql.trim().toLowerCase() === "begin")
    );
    assert.ok(
      poolMock.calls.some((c) => c.sql.trim().toLowerCase() === "commit")
    );
  });
});

test("DELETE /api/courses/delete/1 rejects spoofed uid (regression)", async () => {
  const poolMock = createPoolMock([]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/courses/delete/1", {
      method: "DELETE",
      headers: authHeaders({ uid: "student-1", role: "user" }),
      body: { uid: "admin-1" },
    });

    assert.equal(response.status, 403);
    assert.equal(poolMock.calls.length, 0);
  });
});

test("DELETE /api/courses/delete/1 returns 403 for user role", async () => {
  const poolMock = createPoolMock(sqlMock((sql) => {
      const q = sql.toLowerCase();
      if (q.includes("select role from users")) {
        return { rows: [{ role: "user" }] };
      }
      return { rows: [] };
    }));
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/courses/delete/1", {
      method: "DELETE",
      headers: authHeaders({ role: "user", uid: "student-1" }),
      body: { uid: "student-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 403);
    assert.equal(body.error, "Bạn không có quyền xóa khóa học");
  });
});

test("DELETE /api/courses/delete/1 returns 404 when course missing", async () => {
  const poolMock = createPoolMock(sqlMock((sql) => {
      const q = sql.toLowerCase();
      if (q.includes("select role from users")) {
        return { rows: [{ role: "admin" }] };
      }
      if (q.includes("select instructor_uid from courses")) return { rows: [] };
      return { rows: [] };
    }));
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/courses/delete/999", {
      method: "DELETE",
      headers: authHeaders(),
      body: { uid: "admin-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.error, "Không tìm thấy khóa học để xóa");
  });
});

test("DELETE /api/courses/delete/:id không có body không được trả 500 (Express 5 req.body undefined)", async () => {
  // Express 5 đặt req.body = undefined khi request không có body. Controller đọc
  // thẳng req.body.uid sẽ ném TypeError -> 500. Middleware trong app.js phải
  // chuẩn hoá về {} để giữ hành vi của Express 4.
  const poolMock = createPoolMock(sqlMock((sql) => {
    const q = sql.toLowerCase();
    if (q.includes("select role from users")) return { rows: [{ role: "admin" }] };
    if (q.includes("select instructor_uid from courses")) return { rows: [] };
    return { rows: [] };
  }));
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ request }) => {
    // Cố tình KHÔNG gửi body và KHÔNG set Content-Type.
    const response = await request("/api/courses/delete/999", {
      method: "DELETE",
      headers: authHeaders({ uid: "admin-1", role: "admin" }),
    });

    assert.notEqual(response.status, 500, "không được 500 khi request thiếu body");
    assert.equal(response.status, 404);
  });
});
