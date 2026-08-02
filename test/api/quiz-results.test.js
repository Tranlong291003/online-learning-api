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

test("POST /api/quiz-results/submit returns 201 with auto-graded score", async () => {
  const poolMock = createPoolMock([
    { rows: [{ type: "trac_nghiem" }] },
    {
      rows: [
        {
          question_id: 1,
          question: "1+1?",
          options: '["1","2"]',
          correct_index: 0,
        },
      ],
    },
    { rows: [{ result_id: 7 }] },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/quiz-results/submit", {
      method: "POST",
      headers: authHeaders({ role: "user", uid: "student-1" }),
      body: {
        uid: "student-1",
        quiz_id: 1,
        answers: { 1: 0 },
        explanation: "my answer",
      },
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.result_id, 7);
    assert.equal(body.score, 10);
    assert.equal(body.total_answered, 1);
    assert.equal(body.correct_answers, 1);
    assert.deepEqual(body.invalid_question_ids, []);
    assert.equal(body.questions[0].is_correct, true);
    const insertCall = poolMock.calls[2];
    assert.match(insertCall.sql, /INSERT INTO quiz_results/);
    assert.equal(insertCall.params[0], "student-1");
    assert.equal(insertCall.params[1], 1);
    assert.equal(insertCall.params[2], 10);
    assert.equal(insertCall.params[3], JSON.stringify({ 1: 0 }));
    assert.equal(insertCall.params[5], "da_cham");
  });
});

test("POST /api/quiz-results/submit returns 400 when fields missing", async () => {
  const { app } = loadApp({ poolMock: createPoolMock() });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/quiz-results/submit", {
      method: "POST",
      headers: authHeaders(),
      body: { quiz_id: 1, answers: {} },
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error, "Thiếu user_uid, quiz_id hoặc câu trả lời");
  });
});

test("POST /api/quiz-results/submit returns 404 when quiz missing", async () => {
  const poolMock = createPoolMock([{ rows: [] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/quiz-results/submit", {
      method: "POST",
      headers: authHeaders(),
      body: { uid: "student-1", quiz_id: 99, answers: { 1: 0 } },
    });
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.error, "Không tìm thấy bài kiểm tra");
  });
});

test("GET /api/quiz-results/users/user-1/results returns results list", async () => {
  const submittedAt = new Date("2026-01-01T00:00:00.000Z");
  const poolMock = createPoolMock([
    {
      rows: [
        {
          result_id: 1,
          title: "Quiz 1",
          score: 8,
          passed: "1",
          submitted_at: submittedAt,
        },
        {
          result_id: 2,
          title: "Quiz 2",
          score: 4,
          passed: "0",
          submitted_at: submittedAt,
        },
      ],
    },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ request }) => {
    const response = await request("/api/quiz-results/users/user-1/results", {
      headers: authHeaders(),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.user_uid, "user-1");
    assert.equal(body.total, 2);
    assert.equal(body.results[0].title, "Quiz 1");
    assert.equal(body.results[0].passed, true);
    assert.equal(body.results[1].passed, false);
    assert.equal(body.results[0].submitted_at, submittedAt.toISOString());
    assert.match(poolMock.calls[0].sql, /FROM quiz_results qr/);
    assert.match(poolMock.calls[0].sql, /WHERE qr.user_uid = \$1/);
    assert.equal(poolMock.calls[0].params[0], "user-1");
  });
});

test("GET /api/quiz-results/users//results (empty user_uid) - 400 branch unreachable", async () => {
  // Express 5 requires a non-empty :user_uid segment, so the controller's
  // `if (!user_uid) return 400` branch can never fire over HTTP. The request
  // falls through to the framework's 404 handler instead.
  const { app } = loadApp({ poolMock: createPoolMock() });

  await withServer(app, async ({ request }) => {
    const response = await request("/api/quiz-results/users//results", {
      headers: authHeaders(),
    });

    assert.equal(response.status, 404);
  });
});

test("GET /api/quiz-results/1 returns detailed result without spawning AI workers", async () => {
  const poolMock = createPoolMock([
    {
      rows: [
        {
          result_id: 1,
          quiz_id: 1,
          user_uid: "student-1",
          answers: '{"1":0,"2":1}',
          score: 10,
          explanation: "",
        },
      ],
    },
    {
      rows: [
        {
          question_id: 1,
          question: "A?",
          options: '["a","b"]',
          correct_index: 0,
        },
        {
          question_id: 2,
          question: "B?",
          options: '["a","b"]',
          correct_index: 1,
        },
      ],
    },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ request }) => {
    const response = await request("/api/quiz-results/1", {
      headers: authHeaders(),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.message, "Kết quả bài làm");
    assert.equal(body.data.quiz_id, 1);
    assert.equal(body.data.user_uid, "student-1");
    assert.equal(body.data.total_correct_answers, 2);
    assert.equal(body.data.total_wrong_answers, 0);
    assert.equal(body.data.questions.length, 2);
    assert.equal(body.data.questions[0].question_id, 1);
    assert.equal(body.data.questions[0].is_correct, true);
    assert.equal(body.data.questions[0].explanation, null);
    assert.match(poolMock.calls[0].sql, /SELECT \* FROM quiz_results/);
    assert.match(poolMock.calls[1].sql, /FROM quiz_questions/);
  });
});

test("GET /api/quiz-results/1 returns 404 when result missing", async () => {
  const poolMock = createPoolMock([{ rows: [] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ request }) => {
    const response = await request("/api/quiz-results/1", {
      headers: authHeaders(),
    });
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.error, "Không tìm thấy kết quả bài làm");
  });
});

test("PATCH /api/quiz-results/quiz-results/1/grade returns 200 with graded_by_uid", async () => {
  const poolMock = createPoolMock([
    { rows: [{ uid: "mentor-1", role: "mentor" }] },
    { rows: [{ result_id: 1 }] },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/quiz-results/quiz-results/1/grade", {
      method: "PATCH",
      headers: authHeaders({ role: "mentor", uid: "mentor-1" }),
      body: { uid: "mentor-1", explanation: "Good work", score: 9 },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.message, "Chấm điểm bài kiểm tra thành công");
    assert.equal(poolMock.calls.length, 2);
    assert.match(poolMock.calls[0].sql, /SELECT uid, role FROM users/);
    assert.equal(poolMock.calls[0].params[0], "mentor-1");
    assert.match(
      poolMock.calls[1].sql,
      /graded_by_uid/,
      "UPDATE must set graded_by_uid"
    );
    assert.equal(poolMock.calls[1].params[2], "mentor-1");
    assert.equal(poolMock.calls[1].params[3], "1");
  });
});

test("PATCH /api/quiz-results/quiz-results/1/grade returns 400 when fields missing", async () => {
  const { app } = loadApp({ poolMock: createPoolMock() });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/quiz-results/quiz-results/1/grade", {
      method: "PATCH",
      headers: authHeaders(),
      body: { uid: "mentor-1" },
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error, "Thiếu thông tin chấm điểm hoặc giải thích");
  });
});

test("PATCH /api/quiz-results/quiz-results/1/grade returns 403 for role user", async () => {
  const poolMock = createPoolMock([{ rows: [{ uid: "student-1", role: "user" }] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/quiz-results/quiz-results/1/grade", {
      method: "PATCH",
      headers: authHeaders({ role: "user", uid: "student-1" }),
      body: { uid: "student-1", explanation: "Good work", score: 9 },
    });
    const body = await response.json();

    assert.equal(response.status, 403);
    assert.equal(body.error, "Bạn không có quyền chấm điểm bài kiểm tra");
  });
});

test("PATCH /api/quiz-results/quiz-results/1/grade returns 404 when grader not found", async () => {
  const poolMock = createPoolMock([{ rows: [] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/quiz-results/quiz-results/1/grade", {
      method: "PATCH",
      headers: authHeaders(),
      body: { uid: "ghost", explanation: "Good work", score: 9 },
    });
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.error, "Không tìm thấy người chấm điểm");
  });
});
