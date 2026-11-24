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
    { rows: [{ type: "trac_nghiem", course_id: 1 }] },
    { rows: [{ enrollment_id: 1 }] },
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
    const insertCall = poolMock.calls.find((c) => /INSERT INTO quiz_results/i.test(c.sql));
    assert.ok(insertCall, "phải có INSERT INTO quiz_results");
    assert.match(insertCall.sql, /INSERT INTO quiz_results/);
    assert.equal(insertCall.params[0], "student-1");
    assert.equal(insertCall.params[1], 1);
    assert.equal(insertCall.params[2], 10);
    assert.equal(insertCall.params[3], JSON.stringify({ 1: 0 }));
    assert.equal(insertCall.params[5], "da_cham");
  });
});

test("POST /api/quiz-results/submit scores against the whole quiz, not only answered questions (regression)", async () => {
  // Trước đây điểm = đúng / số câu ĐÃ GỬI, nên gửi 1 câu đúng trong đề 4 câu
  // vẫn được 10 điểm — vừa sai điểm vừa mở đường gian lận.
  const poolMock = createPoolMock([
    { rows: [{ type: "trac_nghiem", course_id: 1 }] },
    { rows: [{ enrollment_id: 1 }] },
    {
      rows: [
        { question_id: 1, question: "q1", options: '["a","b"]', correct_index: 0 },
        { question_id: 2, question: "q2", options: '["a","b"]', correct_index: 0 },
        { question_id: 3, question: "q3", options: '["a","b"]', correct_index: 0 },
        { question_id: 4, question: "q4", options: '["a","b"]', correct_index: 0 },
      ],
    },
    { rows: [{ result_id: 9 }] },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/quiz-results/submit", {
      method: "POST",
      headers: authHeaders({ role: "user", uid: "student-1" }),
      body: { quiz_id: 1, answers: { 1: 0 } },
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.correct_answers, 1);
    assert.equal(body.total_answered, 1, "vẫn báo số câu thực sự đã làm");
    // 1/4 câu đúng = 2.5 điểm, không phải 10.
    assert.equal(body.score, 2.5);
    const insert = poolMock.calls.find((c) => /INSERT INTO quiz_results/i.test(c.sql));
    assert.equal(insert.params[2], 2.5);
  });
});

test("POST /api/quiz-results/submit accepts numeric strings from form data (regression)", async () => {
  // JSON không phân biệt "1" và 1 khi client dựng body từ form; so sánh strict
  // trước đây khiến học viên chọn đúng vẫn bị 0 điểm.
  const poolMock = createPoolMock([
    { rows: [{ type: "trac_nghiem", course_id: 1 }] },
    { rows: [{ enrollment_id: 1 }] },
    {
      rows: [
        { question_id: 1, question: "q1", options: '["a","b"]', correct_index: 1 },
      ],
    },
    { rows: [{ result_id: 10 }] },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/quiz-results/submit", {
      method: "POST",
      headers: authHeaders({ role: "user", uid: "student-1" }),
      body: { quiz_id: 1, answers: { 1: "1" } },
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.questions[0].is_correct, true);
    assert.equal(body.score, 10);
  });
});

test("POST /api/quiz-results/submit blocks a user who is not enrolled (regression)", async () => {
  // Trước đây chỉ kiểm tra quiz tồn tại, nên bất kỳ ai đã đăng nhập cũng nộp
  // được bài của mọi khoá và đọc ngược đáp án qua response.
  const poolMock = createPoolMock([
    { rows: [{ type: "trac_nghiem", course_id: 42 }] },
    { rows: [] }, // chưa ghi danh
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/quiz-results/submit", {
      method: "POST",
      headers: authHeaders({ role: "user", uid: "student-1" }),
      body: { quiz_id: 1, answers: { 1: 0 } },
    });
    const body = await response.json();

    assert.equal(response.status, 403);
    assert.match(body.error, /chưa ghi danh/);
    assert.ok(
      !poolMock.calls.some((c) => /INSERT INTO quiz_results/i.test(c.sql)),
      "không được lưu kết quả"
    );
  });
});

test("POST /api/quiz-results/submit lets an admin bypass the enrollment check", async () => {
  const poolMock = createPoolMock([
    { rows: [{ type: "trac_nghiem", course_id: 42 }] },
    {
      rows: [{ question_id: 1, question: "q", options: '["a","b"]', correct_index: 0 }],
    },
    { rows: [{ result_id: 5 }] },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/quiz-results/submit", {
      method: "POST",
      headers: authHeaders({ role: "admin", uid: "admin-1" }),
      body: { quiz_id: 1, answers: { 1: 0 } },
    });

    assert.equal(response.status, 201);
  });
});

test("POST /api/quiz-results/submit returns 400 when quiz_id missing", async () => {
  const { app } = loadApp({ poolMock: createPoolMock() });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/quiz-results/submit", {
      method: "POST",
      headers: authHeaders(),
      body: { answers: {} },
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error, "Thiếu quiz_id hoặc câu trả lời");
  });
});

test("POST /api/quiz-results/submit ignores a spoofed uid for a non-admin", async () => {
  const poolMock = createPoolMock([{ rows: [{ type: "trac_nghiem" }] }]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/quiz-results/submit", {
      method: "POST",
      headers: authHeaders({ uid: "student-1", role: "user" }),
      body: { quiz_id: 1, answers: { 1: 0 }, uid: "victim-2" },
    });

    assert.equal(response.status, 403);
    assert.equal(poolMock.calls.length, 0);
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

test("GET /api/quiz-results/:id can skip AI explanations with ?explanations=0", async () => {
  // Trước đây endpoint này spawn worker thread (không chạy được trên Cloudflare
  // Workers) và luôn gọi AI. Nay có công tắc tắt để client chỉ cần điểm.
  const poolMock = createPoolMock([
    {
      rows: [
        {
          result_id: 1,
          quiz_id: 1,
          user_uid: "student-1",
          answers: '{"1":0}',
          score: 5,
        },
      ],
    },
    {
      rows: [{ question_id: 1, question: "A?", options: '["a","b"]', correct_index: 1 }],
    },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ request }) => {
    const response = await request("/api/quiz-results/1?explanations=0", {
      headers: authHeaders({ uid: "student-1", role: "user" }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.data.total_wrong_answers, 1);
    assert.equal(body.data.questions[0].is_correct, false);
    assert.equal(body.data.questions[0].explanation, null);
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

test("PATCH /api/quiz-results/quiz-results/1/grade returns 200 and sets graded_by", async () => {
  const poolMock = createPoolMock([
    { rows: [{ id: 7, role: "mentor" }] },
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
    assert.match(poolMock.calls[0].sql, /SELECT id, role FROM users/);
    assert.equal(poolMock.calls[0].params[0], "mentor-1");
    // Cột thật trong DB là graded_by (int, FK -> users.id). Dùng graded_by_uid
    // sẽ khiến PostgreSQL báo "column does not exist" -> 500 trên server thật.
    assert.match(
      poolMock.calls[1].sql,
      /graded_by = \$3/,
      "UPDATE must set graded_by"
    );
    assert.doesNotMatch(
      poolMock.calls[1].sql,
      /graded_by_uid/,
      "graded_by_uid không tồn tại trong DB thật"
    );
    assert.equal(poolMock.calls[1].params[2], 7, "phải lưu users.id, không phải uid chuỗi");
    // parsePositiveInt ép result_id về SỐ trước khi truyền vào câu SQL.
    assert.equal(poolMock.calls[1].params[3], 1);
  });
});

test("PATCH /api/quiz-results/:id/grade scopes mentor to their own courses (regression: IDOR)", async () => {
  // Trước đây câu UPDATE không có điều kiện sở hữu, nên mentor bất kỳ ghi đè
  // được điểm của mọi bài nộp. Giờ điều kiện nằm ngay trong câu UPDATE.
  const poolMock = createPoolMock([
    { rows: [{ id: 7, role: "mentor" }] },
    { rows: [{ result_id: 1 }] },
  ]);
  const { app } = loadApp({ poolMock });

  await withServer(app, async ({ json }) => {
    const response = await json("/api/quiz-results/quiz-results/1/grade", {
      method: "PATCH",
      headers: authHeaders({ role: "mentor", uid: "mentor-1" }),
      body: { uid: "mentor-1", explanation: "Good work", score: 9 },
    });

    assert.equal(response.status, 200);
    const updateSql = poolMock.calls[1].sql;
    assert.match(updateSql, /EXISTS/, "UPDATE phải có điều kiện sở hữu");
    assert.match(updateSql, /instructor_uid/, "điều kiện sở hữu dựa trên instructor_uid");
    assert.equal(poolMock.calls[1].params[4], "mentor-1", "uid người chấm là tham số cuối");
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

test("PATCH /api/quiz-results/quiz-results/1/grade rejects a score outside 0–10 (regression)", async () => {
  // Trước đây chỉ kiểm tra Number.isFinite, nên score = 999999 hay -5 vẫn ghi
  // được vào DB và làm hỏng điểm trung bình của mọi báo cáo.
  for (const badScore of [-1, 10.5, 999999]) {
    const poolMock = createPoolMock([
      { rows: [{ id: 1, role: "admin" }] },
      { rows: [{ result_id: 1 }] },
    ]);
    const { app } = loadApp({ poolMock });

    await withServer(app, async ({ json }) => {
      const response = await json("/api/quiz-results/quiz-results/1/grade", {
        method: "PATCH",
        headers: authHeaders({ role: "admin", uid: "admin-1" }),
        body: { uid: "admin-1", explanation: "OK", score: badScore },
      });
      const body = await response.json();

      assert.equal(response.status, 400, `score=${badScore} phải bị từ chối`);
      assert.match(body.error, /0 đến 10/);
      assert.equal(poolMock.calls.length, 0, "không được chạm DB khi điểm sai");
    });
  }
});

test("PATCH /api/quiz-results/quiz-results/1/grade accepts the 0 and 10 boundaries", async () => {
  for (const goodScore of [0, 10]) {
    const poolMock = createPoolMock([
      { rows: [{ id: 1, role: "admin" }] },
      { rows: [{ result_id: 1 }] },
    ]);
    const { app } = loadApp({ poolMock });

    await withServer(app, async ({ json }) => {
      const response = await json("/api/quiz-results/quiz-results/1/grade", {
        method: "PATCH",
        headers: authHeaders({ role: "admin", uid: "admin-1" }),
        body: { uid: "admin-1", explanation: "OK", score: goodScore },
      });

      assert.equal(response.status, 200, `score=${goodScore} phải được chấp nhận`);
    });
  }
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
