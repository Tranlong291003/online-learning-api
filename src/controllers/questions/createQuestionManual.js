// controllers/questions/createQuestionManual.js
// Mentor them cau hoi trac nghiem / tu luan thu cong.
// options: array string (se luu vao text JSON); correct_index: int 0-based.
const { insertRows, selectRows, supabaseAdmin } = require("../../services/supabase.service");

const createQuestionManual = async (req, res) => {
  try {
    const { quiz_id, question, options, correct_index, expected_keywords } = req.body;
    const user_uid = req.supabaseUser?.authUser?.id;

    if (!user_uid) return res.status(401).json({ error: "Chưa đăng nhập" });
    if (!quiz_id || isNaN(Number(quiz_id)))
      return res.status(400).json({ error: "quiz_id không hợp lệ" });
    if (!question || !question.trim())
      return res.status(400).json({ error: "Vui lòng nhập nội dung câu hỏi" });

    const { data: quiz, error: qErr } = await selectRows(
      supabaseAdmin, "quizzes", "quiz_id,type,creator_uid",
      { eq: { quiz_id: Number(quiz_id) }, single: true }
    );
    if (qErr) throw qErr;
    if (!quiz) return res.status(404).json({ error: "Không tìm thấy bài kiểm tra" });

    const role = req.supabaseUser?.profile?.role;
    if (role !== "admin" && quiz.creator_uid !== user_uid) {
      return res.status(403).json({ error: "Không có quyền thêm câu hỏi" });
    }

    const insertPayload = {
      quiz_id: Number(quiz_id),
      question: question.trim(),
      options: null,
      correct_index: null,
      expected_keywords: null,
    };

    if (quiz.type === "trac_nghiem") {
      if (!Array.isArray(options) || options.length < 2) {
        return res.status(400).json({ error: "Câu hỏi trắc nghiệm cần ít nhất 2 lựa chọn" });
      }
      const ci = Number(correct_index);
      if (!Number.isInteger(ci) || ci < 0 || ci >= options.length) {
        return res.status(400).json({ error: "correct_index phải là số nguyên từ 0 đến " + (options.length - 1) });
      }
      insertPayload.options = JSON.stringify(options);
      insertPayload.correct_index = ci;
    } else {
      // tu_luan: co the truyen expected_keywords (string CSV)
      if (expected_keywords !== undefined && expected_keywords !== null && expected_keywords !== "") {
        insertPayload.expected_keywords = String(expected_keywords).trim();
      }
    }

    const { data: inserted, error: insErr } = await insertRows(
      supabaseAdmin, "quiz_questions", insertPayload
    );
    if (insErr) throw insErr;

    res.status(201).json({
      message: "Thêm câu hỏi thành công",
      data: inserted && inserted[0] ? inserted[0] : null,
    });
  } catch (err) {
    console.error("createQuestionManual error:", err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = createQuestionManual;
