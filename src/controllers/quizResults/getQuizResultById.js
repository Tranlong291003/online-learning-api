// controllers/quizResults/getQuizResultById.js
const { supabaseAdmin } = require("../../services/supabase.service");

const safeParse = (s) => { try { return JSON.parse(s); } catch (e) { return null; } };

const getQuizResultById = async (req, res) => {
  try {
    const { result_id } = req.params;
    if (!result_id || isNaN(Number(result_id)))
      return res.status(400).json({ error: "result_id không hợp lệ" });

    const user_uid = req.supabaseUser?.authUser?.id;
    const role = req.supabaseUser?.profile?.role;
    if (!user_uid) return res.status(401).json({ error: "Chưa đăng nhập" });

    const { data: result, error } = await supabaseAdmin
      .from("quiz_results")
      .select("*")
      .eq("result_id", Number(result_id))
      .maybeSingle();
    if (error) throw error;
    if (!result) return res.status(404).json({ error: "Không tìm thấy kết quả" });
    if (role !== "admin" && result.user_uid !== user_uid) {
      return res.status(403).json({ error: "Không có quyền xem kết quả này" });
    }

    const { data: quiz } = await supabaseAdmin
      .from("quizzes")
      .select("quiz_id, course_id, title, type")
      .eq("quiz_id", result.quiz_id)
      .maybeSingle();

    const { data: questions } = await supabaseAdmin
      .from("quiz_questions")
      .select("question_id, question, options, correct_index, expected_keywords")
      .eq("quiz_id", result.quiz_id);

    res.status(200).json({
      message: "Chi tiết kết quả",
      data: {
        ...result,
        answers: result.answers ? safeParse(result.answers) : null,
        quiz,
        questions: (questions || []).map((q) => ({
          ...q,
          options: q.options ? safeParse(q.options) : null,
        })),
      },
    });
  } catch (err) {
    console.error("getQuizResultById error:", err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = getQuizResultById;
