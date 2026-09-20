const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createPoolMock,
  loadApp,
  signTestToken,
  withServer,
} = require("../helpers/apiTestUtils");

function authHeaders(payload = {}) {
  return {
    authorization: `Bearer ${signTestToken(payload)}`,
  };
}

function sqlMock(fn, calls = 20) {
  return Array.from({ length: calls }, () => fn);
}

test("GET /api/questions/1 returns questions of a quiz", async () => {
  const poolMock = createPoolMock([
    { rows: [{ quiz_id: 1 }] },
    {
      rows: [
        {
          question_id: 1,
          quiz_id: 1,
          question: "1+1?",
          options: '["1","2"]',
          correct_index: 1,
        },
      ],
    },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ request }) => {
    const response = await request("/api/questions/1", { headers: authHeaders() });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.message, "Danh sách câu hỏi của bài kiểm tra");
    assert.equal(body.data[0].question_id, 1);
    assert.match(poolMock.calls[0].sql, /SELECT quiz_id FROM quizzes/);
    assert.match(poolMock.calls[1].sql, /FROM quiz_questions/);
  });
});

test("GET /api/questions/1 returns 404 when quiz missing", async () => {
  const poolMock = createPoolMock([{ rows: [] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ request }) => {
    const response = await request("/api/questions/1", { headers: authHeaders() });
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.error, "Không tìm thấy quiz này");
  });
});

test("GET /api/questions/1 returns 404 when quiz has no questions", async () => {
  const poolMock = createPoolMock([{ rows: [{ quiz_id: 1 }] }, { rows: [] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ request }) => {
    const response = await request("/api/questions/1", { headers: authHeaders() });
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.error, "Không tìm thấy câu hỏi cho bài kiểm tra này");
  });
});

test("POST /api/questions/createbyuser returns 201 with 0-based correct_index", async () => {
  const poolMock = createPoolMock([
    { rows: [{ role: "admin" }] },
    { rows: [{ type: "trac_nghiem" }] },
    { rows: [] },
    {
      rows: [
        {
          question_id: 1,
          quiz_id: 1,
          question: "1+1?",
          options: '["1","2","3"]',
          correct_index: 1,
        },
      ],
    },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/questions/createbyuser", {
      method: "POST",
      headers: authHeaders({ role: "admin", uid: "admin-1" }),
      body: {
        uid: "admin-1",
        quiz_id: 1,
        question: "1+1?",
        type: "trac_nghiem",
        options: ["1", "2", "3"],
        correct_index: 2,
      },
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.data.correct_index, 1);
    const insertCall = poolMock.calls[3];
    assert.match(insertCall.sql, /INSERT INTO quiz_questions/);
    assert.equal(insertCall.params[0], 1);
    assert.equal(insertCall.params[1], "1+1?");
    assert.equal(insertCall.params[2], JSON.stringify(["1", "2", "3"]));
    assert.equal(insertCall.params[3], 1, "correct_index must be stored 0-based");
  });
});

test("POST /api/questions/createbyuser returns 400 when quiz_id/question missing", async () => {
  const { app } = loadApp({ poolMock: createPoolMock() });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/questions/createbyuser", {
      method: "POST",
      headers: authHeaders(),
      body: { uid: "admin-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(
      body.error,
      "Thiếu thông tin bài kiểm tra (quiz_id) hoặc câu hỏi (question)."
    );
  });
});

test("POST /api/questions/createbyuser returns 400 for invalid correct_index", async () => {
  const poolMock = createPoolMock([
    { rows: [{ role: "admin" }] },
    { rows: [{ type: "trac_nghiem" }] },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/questions/createbyuser", {
      method: "POST",
      headers: authHeaders(),
      body: {
        uid: "admin-1",
        quiz_id: 1,
        question: "1+1?",
        type: "trac_nghiem",
        options: ["1", "2", "3"],
        correct_index: 5,
      },
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.match(body.error, /correct_index phải là số nguyên/);
  });
});

test("POST /api/questions/createbyuser returns 403 for role user", async () => {
  const poolMock = createPoolMock([{ rows: [{ role: "user" }] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/questions/createbyuser", {
      method: "POST",
      headers: authHeaders({ role: "user", uid: "student-1" }),
      body: {
        uid: "student-1",
        quiz_id: 1,
        question: "1+1?",
        type: "trac_nghiem",
        options: ["1", "2"],
        correct_index: 1,
      },
    });
    const body = await response.json();

    assert.equal(response.status, 403);
    assert.equal(body.error, "Bạn không có quyền tạo câu hỏi");
  });
});

test("POST /api/questions/createbyuser returns 404 when quiz missing", async () => {
  const poolMock = createPoolMock([{ rows: [{ role: "admin" }] }, { rows: [] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/questions/createbyuser", {
      method: "POST",
      headers: authHeaders(),
      body: {
        uid: "admin-1",
        quiz_id: 99,
        question: "1+1?",
        type: "trac_nghiem",
        options: ["1", "2"],
        correct_index: 1,
      },
    });
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.error, "Không tìm thấy quiz này.");
  });
});

test("POST /api/questions/createbyai returns 201 with OpenAI-generated questions", async () => {
  const aiQuestion = {
    question: "1+1?",
    options: ["1", "2", "3", "4"],
    correct_index: 1,
  };
  const poolMock = createPoolMock([
    { rows: [{ role: "admin" }] },
    { rows: [{ type: "trac_nghiem" }] },
    { rows: [] }, // BEGIN
    { rows: [{ question_id: 11 }] },
    { rows: [{ question_id: 12 }] },
    { rows: [] }, // COMMIT
  ]);
  const { app } = loadApp({
    poolMock,
    openai: {
      OpenAI: class {
        constructor() {
          this.chat = {
            completions: {
              create: async () => ({
                choices: [{ message: { content: JSON.stringify(aiQuestion) } }],
              }),
            },
          };
        }
      },
    },
  });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/questions/createbyai", {
      method: "POST",
      headers: authHeaders({ role: "admin", uid: "admin-1" }),
      body: {
        uid: "admin-1",
        quiz_id: 1,
        topic: "Toán học",
        number: 2,
        difficulty: "easy",
        type: "trac_nghiem",
      },
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.questions.length, 2);
    assert.match(body.message, /2 câu hỏi/);
    const inserts = poolMock.calls.filter((c) =>
      c.sql.includes("INSERT INTO quiz_questions")
    );
    assert.equal(inserts.length, 2);
    for (const insert of inserts) {
      assert.equal(insert.params[1], "1+1?");
      assert.equal(insert.params[2], JSON.stringify(aiQuestion.options));
      assert.equal(insert.params[3], 0, "AI correct_index stored 0-based (1-based input)");
    }
  });
});

test("POST /api/questions/createbyai returns 400 for invalid difficulty", async () => {
  const { app } = loadApp({ poolMock: createPoolMock() });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/questions/createbyai", {
      method: "POST",
      headers: authHeaders(),
      body: {
        uid: "admin-1",
        quiz_id: 1,
        topic: "Toán học",
        difficulty: "insane",
      },
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.match(body.error, /difficulty không hợp lệ/);
  });
});

test("POST /api/questions/createbyai returns 400 when quiz_id/topic missing", async () => {
  const { app } = loadApp({ poolMock: createPoolMock() });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/questions/createbyai", {
      method: "POST",
      headers: authHeaders(),
      body: { difficulty: "easy" },
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error, "Thiếu quiz_id hoặc topic");
  });
});

test("POST /api/questions/createbyai returns 403 for role user", async () => {
  const poolMock = createPoolMock([{ rows: [{ role: "user" }] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/questions/createbyai", {
      method: "POST",
      headers: authHeaders({ role: "user", uid: "student-1" }),
      body: {
        uid: "student-1",
        quiz_id: 1,
        topic: "Toán học",
        difficulty: "easy",
      },
    });
    const body = await response.json();

    assert.equal(response.status, 403);
    assert.equal(body.error, "Bạn không có quyền tạo câu hỏi AI");
  });
});

test("POST /api/questions/createbyai returns 404 when quiz missing", async () => {
  const poolMock = createPoolMock([{ rows: [{ role: "admin" }] }, { rows: [] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/questions/createbyai", {
      method: "POST",
      headers: authHeaders(),
      body: {
        uid: "admin-1",
        quiz_id: 99,
        topic: "Toán học",
        difficulty: "easy",
      },
    });
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.error, "Quiz không tồn tại");
  });
});

test("POST /api/questions/createbyai rejects an oversized number (regression: OOM crash)", async () => {
  const poolMock = createPoolMock();
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/questions/createbyai", {
      method: "POST",
      headers: authHeaders(),
      body: {
        uid: "admin-1",
        quiz_id: 1,
        topic: "Toán học",
        difficulty: "easy",
        number: 1000000,
      },
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.match(body.error, /Số lượng câu hỏi không hợp lệ/);
    // Bị chặn trước khi chạm tới OpenAI/DB: không query nào được chạy.
    assert.equal(poolMock.calls.length, 0);
  });
});

test("POST /api/questions/createbyai rejects non-integer number values", async () => {
  for (const badNumber of [0, -1, 1.5, "abc", 21]) {
    const poolMock = createPoolMock();
    const { app } = loadApp({ poolMock });

    await withServer(app, async ({ json }) => {
      const response = await json("/api/questions/createbyai", {
        method: "POST",
        headers: authHeaders(),
        body: {
          uid: "admin-1",
          quiz_id: 1,
          topic: "Toán học",
          difficulty: "easy",
          number: badNumber,
        },
      });
      const body = await response.json();

      assert.equal(response.status, 400, `number=${badNumber} phải bị từ chối`);
      assert.match(body.error, /Số lượng câu hỏi không hợp lệ/);
    });
  }
});

test("PUT /api/questions/update/1 keeps old expected_keywords for tu_luan", async () => {
  const poolMock = createPoolMock([
    { rows: [{ role: "mentor" }] },
    {
      rows: [
        {
          question_id: 1,
          quiz_id: 5,
          question: "Old question",
          options: null,
          correct_index: null,
          expected_keywords: "keyword x",
        },
      ],
    },
    { rows: [{ type: "tu_luan" }] },
    { rows: [] },
    { rows: [{ question_id: 1, question: "New question", expected_keywords: "keyword x" }] },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/questions/update/1", {
      method: "PUT",
      headers: authHeaders({ role: "mentor", uid: "mentor-1" }),
      body: { uid: "mentor-1", question: "New question" },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.data.question, "New question");
    const updateCall = poolMock.calls[4];
    assert.match(updateCall.sql, /UPDATE quiz_questions SET/);
    assert.equal(updateCall.params[0], "New question");
    assert.equal(
      updateCall.params[3],
      "keyword x",
      "old expected_keywords must be kept when not provided"
    );
  });
});

test("PUT /api/questions/update/1 stores correct_index 0-based for trac_nghiem", async () => {
  const poolMock = createPoolMock(sqlMock((sql) => {
    const q = sql.toLowerCase();
    if (q.includes("select role from users")) {
      return { rows: [{ role: "mentor" }] };
    }
    if (q.includes("select qq.question_id")) {
      return { rows: [{ question_id: 1, quiz_id: 5, options: '["A"]', correct_index: 0, expected_keywords: null }] };
    }
    if (q.includes("select type from quizzes")) {
      return { rows: [{ type: "trac_nghiem" }] };
    }
    if (q.includes("select question_id from quiz_questions")) {
      return { rows: [] };
    }
    if (q.includes("update quiz_questions")) {
      return { rows: [{ question_id: 1 }] };
    }
    return { rows: [] };
  }));
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/questions/update/1", {
      method: "PUT",
      headers: authHeaders({ role: "mentor", uid: "mentor-1" }),
      body: {
        uid: "mentor-1",
        question: "New question",
        options: ["A", "B", "C", "D"],
        correct_index: 2,
      },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    const updateCall = poolMock.calls[4];
    assert.match(updateCall.sql, /UPDATE quiz_questions SET/);
    assert.deepEqual(JSON.parse(updateCall.params[1]), ["A", "B", "C", "D"]);
    assert.equal(updateCall.params[2], 1, "correct_index must be stored 0-based");
  });
});

test("PUT /api/questions/update/1 returns 400 when correct_index out of range", async () => {
  const poolMock = createPoolMock(sqlMock((sql) => {
    const q = sql.toLowerCase();
    if (q.includes("select role from users")) {
      return { rows: [{ role: "mentor" }] };
    }
    if (q.includes("select qq.question_id")) {
      return { rows: [{ question_id: 1, quiz_id: 5, question: "x", options: '["A"]', correct_index: 0, expected_keywords: null }] };
    }
    if (q.includes("select type from quizzes")) {
      return { rows: [{ type: "trac_nghiem" }] };
    }
    return { rows: [] };
  }));
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/questions/update/1", {
      method: "PUT",
      headers: authHeaders({ role: "mentor", uid: "mentor-1" }),
      body: { uid: "mentor-1", options: ["A", "B"], correct_index: 9 },
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.match(body.message, /correct_index phải là số nguyên/);
  });
});

test("PUT /api/questions/update/1 rejects spoofed uid (regression)", async () => {
  const poolMock = createPoolMock();
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/questions/update/1", {
      method: "PUT",
      headers: authHeaders({ uid: "student-1", role: "user" }),
      body: { question: "New question", uid: "admin-1" },
    });

    assert.equal(response.status, 403);
    assert.equal(poolMock.calls.length, 0);
  });
});

test("PUT /api/questions/update/1 returns 403 for role user", async () => {
  const poolMock = createPoolMock([{ rows: [{ role: "user" }] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/questions/update/1", {
      method: "PUT",
      headers: authHeaders({ role: "user", uid: "student-1" }),
      body: { uid: "student-1", question: "New question" },
    });
    const body = await response.json();

    assert.equal(response.status, 403);
    assert.equal(body.error, "Bạn không có quyền cập nhật câu hỏi");
  });
});

test("PUT /api/questions/update/1 returns 404 when question missing", async () => {
  const poolMock = createPoolMock([{ rows: [{ role: "admin" }] }, { rows: [] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/questions/update/1", {
      method: "PUT",
      headers: authHeaders(),
      body: { uid: "admin-1", question: "New question" },
    });
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.message, "Câu hỏi không tồn tại hoặc đã bị xóa.");
  });
});

test("DELETE /api/questions/delete/1 returns 200", async () => {
  const poolMock = createPoolMock([
    { rows: [{ role: "admin" }] },
    { rows: [{ question_id: 1 }] },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/questions/delete/1", {
      method: "DELETE",
      headers: authHeaders(),
      body: { uid: "admin-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.message, "Xóa câu hỏi thành công");
    assert.match(poolMock.calls[1].sql, /DELETE FROM quiz_questions/);
    assert.equal(poolMock.calls[1].params[0], "1");
  });
});

test("DELETE /api/questions/delete/1 rejects spoofed uid (regression)", async () => {
  const poolMock = createPoolMock();
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/questions/delete/1", {
      method: "DELETE",
      headers: authHeaders({ uid: "student-1", role: "user" }),
      body: { uid: "admin-1" },
    });

    assert.equal(response.status, 403);
    assert.equal(poolMock.calls.length, 0);
  });
});

test("DELETE /api/questions/delete/1 returns 403 for role user", async () => {
  const poolMock = createPoolMock([{ rows: [{ role: "user" }] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/questions/delete/1", {
      method: "DELETE",
      headers: authHeaders({ role: "user", uid: "student-1" }),
      body: { uid: "student-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 403);
    assert.equal(body.error, "Bạn không có quyền xóa câu hỏi");
  });
});

test("DELETE /api/questions/delete/1 returns 404 when question missing", async () => {
  const poolMock = createPoolMock([{ rows: [{ role: "admin" }] }, { rows: [] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/questions/delete/1", {
      method: "DELETE",
      headers: authHeaders(),
      body: { uid: "admin-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.error, "Câu hỏi không tồn tại");
  });
});
