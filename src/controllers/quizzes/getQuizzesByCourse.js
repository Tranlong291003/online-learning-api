// controllers/quizzes/getQuizzesByCourse.js
// Lay danh sach quiz theo course. Khong kem correct_index/expected_keywords neu chua submit.
const { supabaseAdmin } = require("../../services/supabase.service");

const getQuizzesByCourse = async (req, res) => {
  try {
    const { course_id } = req.params;
    if (!course_id || isNaN(Number(course_id)))
      return res.status(400).json({ error: "course_id không hợp lệ" });

    const { data: quizzes, error } = await supabaseAdmin
      .from("quizzes")
      .select("quiz_id, course_id, title, description, type, time_limit, attempt_limit, created_at")
      .eq("course_id", Number(course_id))
      .order("created_at", { ascending: true });
    if (error) throw error;
    if (!quizzes || !quizzes.length)
      return res.status(200).json({ message: "Chưa có bài kiểm tra", data: [] });

    const quizIds = quizzes.map((q) => q.quiz_id);
    const { data: questions } = await supabaseAdmin
      .from("quiz_questions")
      .select("question_id, quiz_id, question, options")
      .in("quiz_id", quizIds);
    const qMap = {};
    for (const q of questions || []) {
      if (!qMap[q.quiz_id]) qMap[q.quiz_id] = [];
      qMap[q.quiz_id].push({
        question_id: q.question_id,
        question: q.question,
        options: q.options ? safeParseJSON(q.options, []) : [],
      });
    }
    const data = quizzes.map((qz) => ({ ...qz, questions: qMap[qz.quiz_id] || [] }));
    res.status(200).json({ message: "Danh sách bài kiểm tra", data });
  } catch (err) {
    console.error("getQuizzesByCourse error:", err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

function safeParseJSON(str, fallback) {
  try { return JSON.parse(str); } catch (e) { return fallback; }
}

module.exports = getQuizzesByCourse;
