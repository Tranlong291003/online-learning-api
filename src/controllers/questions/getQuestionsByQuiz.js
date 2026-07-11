// controllers/questions/getQuestionsByQuiz.js
// Lay tat ca cau hoi theo quiz_id. options la JSON string -> parse thanh array.
const { supabaseAdmin } = require("../../services/supabase.service");

const safeParse = (s) => { try { return JSON.parse(s); } catch (e) { return []; } };

const getQuestionsByQuiz = async (req, res) => {
  try {
    const { quiz_id } = req.params;
    if (!quiz_id || isNaN(Number(quiz_id)))
      return res.status(400).json({ error: "quiz_id không hợp lệ" });

    const { data: questions, error } = await supabaseAdmin
      .from("quiz_questions")
      .select("question_id, quiz_id, question, options, correct_index, expected_keywords, created_at")
      .eq("quiz_id", Number(quiz_id))
      .order("created_at", { ascending: true });
    if (error) throw error;
    if (!questions || !questions.length)
      return res.status(200).json({ message: "Chưa có câu hỏi", data: [] });

    const data = questions.map((q) => ({
      ...q,
      options: q.options ? safeParse(q.options) : null,
    }));
    res.status(200).json({ message: "Danh sách câu hỏi", data });
  } catch (err) {
    console.error("getQuestionsByQuiz error:", err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = getQuestionsByQuiz;
