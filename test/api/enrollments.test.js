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

test("POST /api/enrollments/register returns 201 with enrollment and notification", async () => {
  const poolMock = createPoolMock(sqlMock((sql) => {
      const q = sql.toLowerCase();
      if (q.includes("select course_id, title from courses")) {
        return { rows: [{ course_id: 1, title: "Course A" }] };
      }
      if (q.includes("from users where uid")) {
        return { rows: [{ uid: "user-1", fcm_token: "fcm-1" }] };
      }
      if (q.includes("select * from enrollments")) return { rows: [] };
      if (q.includes("insert into enrollments")) {
        return { rows: [{ enrollment_id: 7 }] };
      }
      if (q.includes("insert into notifications")) {
        return { rows: [{ noti_id: 3 }] };
      }
      return { rows: [] };
    }));
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/enrollments/register", {
      method: "POST",
      headers: authHeaders(),
      body: { userUid: "user-1", courseId: 1 },
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.message, "Đăng ký khóa học thành công");
    assert.equal(body.enrollment_id, 7);
    assert.equal(body.notification.noti_id, 3);
    assert.equal(body.notification.sent, true);
  });
});

test("POST /api/enrollments/register returns 400 when courseId missing", async () => {
  const { app } = loadApp();

  await withServer(app, async ({ json }) => {
    const response = await json("/api/enrollments/register", {
      method: "POST",
      headers: authHeaders(),
      body: { userUid: "user-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.match(body.error, /courseId/);
  });
});

test("POST /api/enrollments/register ignores a spoofed userUid for a non-admin", async () => {
  const poolMock = createPoolMock();
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/enrollments/register", {
      method: "POST",
      headers: authHeaders({ uid: "user-1", role: "user" }),
      body: { userUid: "victim-2", courseId: 1 },
    });

    assert.equal(response.status, 403);
    assert.equal(poolMock.calls.length, 0);
  });
});

test("POST /api/enrollments/register returns 404 when course not found", async () => {
  const poolMock = createPoolMock(sqlMock((sql) => {
      const q = sql.toLowerCase();
      if (q.includes("select course_id, title from courses")) {
        return { rows: [] };
      }
      return { rows: [] };
    }));
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/enrollments/register", {
      method: "POST",
      headers: authHeaders(),
      body: { userUid: "user-1", courseId: 999 },
    });
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.error, "Khóa học không tồn tại");
  });
});

test("POST /api/enrollments/register returns 404 when user not found", async () => {
  const poolMock = createPoolMock(sqlMock((sql) => {
      const q = sql.toLowerCase();
      if (q.includes("select course_id, title from courses")) {
        return { rows: [{ course_id: 1, title: "Course A" }] };
      }
      if (q.includes("from users where uid")) return { rows: [] };
      return { rows: [] };
    }));
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/enrollments/register", {
      method: "POST",
      headers: authHeaders(),
      body: { userUid: "ghost", courseId: 1 },
    });
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.error, "Không tìm thấy người dùng");
  });
});

test("POST /api/enrollments/register returns 400 when already enrolled", async () => {
  const poolMock = createPoolMock(sqlMock((sql) => {
      const q = sql.toLowerCase();
      if (q.includes("select course_id, title from courses")) {
        return { rows: [{ course_id: 1, title: "Course A" }] };
      }
      if (q.includes("from users where uid")) {
        return { rows: [{ uid: "user-1", fcm_token: null }] };
      }
      if (q.includes("select * from enrollments")) {
        return { rows: [{ enrollment_id: 1 }] };
      }
      return { rows: [] };
    }));
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/enrollments/register", {
      method: "POST",
      headers: authHeaders(),
      body: { userUid: "user-1", courseId: 1 },
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error, "Bạn đã đăng ký khóa học này");
  });
});

test("GET /api/enrollments/user/user-1 splits completed and in_progress", async () => {
  const poolMock = createPoolMock(sqlMock((sql) => {
      const q = sql.toLowerCase();
      if (q.includes("join courses")) {
        return {
          rows: [
            {
              course_id: 1,
              title: "Completed course",
              total_lessons: "10",
              completed_lessons: "10",
              progress_percent: "100",
              total_duration: "1 Giờ 0 phút",
            },
            {
              course_id: 2,
              title: "In progress course",
              total_lessons: "10",
              completed_lessons: "4",
              progress_percent: "40",
              total_duration: "30 phút",
            },
          ],
        };
      }
      return { rows: [] };
    }));
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ request }) => {
    const response = await request("/api/enrollments/user/user-1", {
      headers: authHeaders(),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.data.completed.length, 1);
    assert.equal(body.data.completed[0].course_id, 1);
    assert.equal(body.data.in_progress.length, 1);
    assert.equal(body.data.in_progress[0].course_id, 2);
  });
});

test("DELETE /api/enrollments/delete/1 returns 200", async () => {
  const poolMock = createPoolMock([
    { rows: [{ user_uid: "user-1" }] },
    { rows: [{ enrollment_id: 1 }] },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ request }) => {
    const response = await request("/api/enrollments/delete/1", {
      method: "DELETE",
      headers: authHeaders({ uid: "user-1", role: "user" }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.message, "🗑️ Huỷ đăng ký thành công");
  });
});

test("DELETE /api/enrollments/delete/1 returns 403 when not the owner (regression)", async () => {
  const poolMock = createPoolMock([
    { rows: [{ user_uid: "someone-else" }] },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ request }) => {
    const response = await request("/api/enrollments/delete/1", {
      method: "DELETE",
      headers: authHeaders({ uid: "student-1", role: "user" }),
    });

    assert.equal(response.status, 403);
    assert.equal(poolMock.calls.length, 1);
  });
});

test("DELETE /api/enrollments/delete/999 returns 404", async () => {
  const poolMock = createPoolMock([{ rows: [] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ request }) => {
    const response = await request("/api/enrollments/delete/999", {
      method: "DELETE",
      headers: authHeaders(),
    });
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.error, "❌ Không tìm thấy đăng ký để huỷ");
  });
});

test("GET /api/enrollments/progress returns progress percent", async () => {
  const poolMock = createPoolMock(sqlMock((sql) => {
      const q = sql.toLowerCase();
      if (q.includes("total_lessons")) {
        return { rows: [{ total_lessons: "4" }] };
      }
      if (q.includes("completed_lessons")) {
        return { rows: [{ completed_lessons: "2" }] };
      }
      return { rows: [] };
    }));
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ request }) => {
    const response = await request(
      "/api/enrollments/progress?userUid=user-1&courseId=1",
      { headers: authHeaders() }
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.message, "Lấy tiến độ học tập thành công");
    assert.equal(body.data.total_lessons, 4);
    assert.equal(body.data.completed_lessons, 2);
    assert.equal(body.data.progress_percent, 50);
  });
});

test("GET /api/enrollments/progress returns 400 when courseId missing", async () => {
  const { app } = loadApp();

  await withServer(app, async ({ request }) => {
    const response = await request("/api/enrollments/progress", {
      headers: authHeaders(),
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.match(body.error, /courseId/);
  });
});

test("GET /api/enrollments/progress returns 400 for a malformed courseId (regression)", async () => {
  // "abc" từng được Number() hoá thành NaN rồi gửi thẳng vào PostgreSQL, khiến
  // API trả 500 kèm chi tiết lỗi CSDL thay vì 400.
  const poolMock = createPoolMock();
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ request }) => {
    const response = await request("/api/enrollments/progress?courseId=abc", {
      headers: authHeaders(),
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.match(body.error, /courseId/);
    assert.equal(poolMock.calls.length, 0);
  });
});

test("GET /api/enrollments/progress ignores a spoofed userUid for a non-admin", async () => {
  const poolMock = createPoolMock();
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ request }) => {
    const response = await request(
      "/api/enrollments/progress?courseId=1&userUid=victim-2",
      { headers: authHeaders({ uid: "user-1", role: "user" }) }
    );

    assert.equal(response.status, 403);
    assert.equal(poolMock.calls.length, 0);
  });
});

test("GET /api/enrollments/check/user-1/1 returns enrolled true", async () => {
  const poolMock = createPoolMock(sqlMock((sql) => {
      const q = sql.toLowerCase();
      if (q.includes("select course_id from courses")) {
        return { rows: [{ course_id: 1 }] };
      }
      if (q.includes("select * from enrollments")) {
        return { rows: [{ enrollment_id: 1 }] };
      }
      return { rows: [] };
    }));
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ request }) => {
    const response = await request("/api/enrollments/check/user-1/1", {
      headers: authHeaders(),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.enrolled, true);
  });
});

test("GET /api/enrollments/check/user-1/1 returns enrolled false", async () => {
  const poolMock = createPoolMock(sqlMock((sql) => {
      const q = sql.toLowerCase();
      if (q.includes("select course_id from courses")) {
        return { rows: [{ course_id: 1 }] };
      }
      if (q.includes("select * from enrollments")) return { rows: [] };
      return { rows: [] };
    }));
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ request }) => {
    const response = await request("/api/enrollments/check/user-1/1", {
      headers: authHeaders(),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.enrolled, false);
  });
});

test("GET /api/enrollments/check/ returns 400 for missing param", async () => {
  const { app } = loadApp({ poolMock: createPoolMock() });

  await withServer(app, async ({ request }) => {
    const response = await request("/api/enrollments/check/%ZZ/1", {
      headers: authHeaders(),
    });

    assert.equal(response.status, 400);
  });
});

test("GET /api/enrollments/check/user-1/999 returns 404 when course missing", async () => {
  const poolMock = createPoolMock(sqlMock((sql) => {
      const q = sql.toLowerCase();
      if (q.includes("select course_id from courses")) return { rows: [] };
      return { rows: [] };
    }));
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ request }) => {
    const response = await request("/api/enrollments/check/user-1/999", {
      headers: authHeaders(),
    });
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.error, "Khóa học không tồn tại");
  });
});
