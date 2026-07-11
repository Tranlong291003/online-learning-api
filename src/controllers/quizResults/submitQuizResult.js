// controllers/quizResults/submitQuizResult.js
// User noi bai: trac_nghiem tu cham, tu_luan status='cho_cham'.
// answers: array [{question_id, selected_index/answer}], luu thanh JSON string.
const { insertRows, selectRows, supabaseAdmin } = require("../../services/supabase.service");

const safeParse = (s) => { try { return JSON.parse(s); } catch (e) { return []; } };

const submitQuizResult = async (req, res) => {
  try {
    const { quiz_id, answers, explanation } = req.body;
    const user_uid = req.supabaseUser?.authUser?.id;

    if (!user_uid) return res.status(401).json({ error: "Chưa đăng nhập" });
    if (!quiz_id || isNaN(Number(quiz_id)))
      return res.status(400).json({ error: "quiz_id không hợp lệ" });
    if (!Array.isArray(answers) || answers.length === 0)
      return res.status(400).json({ error: "answers phải là mảng không rỗng" });

    const { data: quiz, error: qErr } = await selectRows(
      supabaseAdmin, "quizzes", "quiz_id,course_id,type,attempt_limit",
      { eq: { quiz_id: Number(quiz_id) }, single: true }
    );
    if (qErr) throw qErr;
    if (!quiz) return res.status(404).json({ error: "Không tìm thấy bài kiểm tra" });

    // Kiem tra user da enroll
    const { data: enrolled } = await supabaseAdmin
      .from("enrollments")
      .select("enrollment_id")
      .eq("user_uid", user_uid)
      .eq("course_id", quiz.course_id)
      .limit(1);
    if (!enrolled || !enrolled.length) {
      return res.status(403).json({ error: "Cần đăng ký khóa học trước khi làm bài" });
    }

    // Kiem tra attempt_limit
    if (quiz.attempt_limit) {
      const { count } = await supabaseAdmin
        .from("quiz_results")
        .select("result_id", { count: "exact", head: true })
        .eq("user_uid", user_uid)
        .eq("quiz_id", Number(quiz_id));
      if ((count || 0) >= quiz.attempt_limit) {
        return res.status(429).json({ error: "Bạn đã hết lượt làm bài" });
      }
    }

    // Lay danh sach cau hoi
    const { data: questions } = await supabaseAdmin
      .from("quiz_questions")
      .select("question_id, options, correct_index, expected_keywords")
      .eq("quiz_id", Number(quiz_id));
    if (!questions || !questions.length)
      return res.status(400).json({ error: "Bài kiểm tra chưa có câu hỏi" });

    let score = 0;
    const total = questions.length;

    if (quiz.type === "trac_nghiem") {
      const answerMap = new Map(
        answers.map((a) => [Number(a.question_id), Number(a.selected_index)])
      );
      for (const q of questions) {
        if (q.correct_index !== null && answerMap.get(q.question_id) === q.correct_index) score += 1;
      }
    }

    const insertPayload = {
      user_uid,
      quiz_id: Number(quiz_id),
      score: quiz.type === "trac_nghiem" ? (score / total) * 10 : null,
      answers: JSON.stringify(answers),
      explanation: explanation ? String(explanation).trim() : null,
      status: quiz.type === "trac_nghiem" ? "da_cham" : "cho_cham",
      submitted_at: new Date().toISOString(),
    };

    const { data: inserted, error: insErr } = await insertRows(
      supabaseAdmin, "quiz_results", insertPayload
    );
    if (insErr) throw insErr;

    res.status(201).json({
      message: "Nộp bài thành công",
      data: inserted && inserted[0] ? inserted[0] : null,
    });
  } catch (err) {
    console.error("submitQuizResult error:", err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = submitQuizResult;
