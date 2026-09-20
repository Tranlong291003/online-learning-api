const { pool } = require("../../config/db.config");
const { resolveActorUid } = require("../../middleware/actor");

const createQuestion = async (req, res) => {
  const {
    quiz_id,
    question,
    type: submittedType,
    options,
    correct_index,
    expected_keywords,
  } = req.body;

  if (!quiz_id || !question) {
    return res.status(400).json({
      error: "Thiếu thông tin bài kiểm tra (quiz_id) hoặc câu hỏi (question).",
    });
  }

  // Lấy uid từ token; chỉ admin mới được thao tác thay người khác
  const uid = resolveActorUid(req, res, req.body.uid);
  if (!uid) return;

  try {
    // Kiểm tra quyền
    const roleResult = await pool.query("SELECT role FROM users WHERE uid = $1", [uid]);
    const userRole = roleResult.rows[0]?.role;

    if (userRole !== "admin" && userRole !== "mentor") {
      return res.status(403).json({ error: "Bạn không có quyền tạo câu hỏi" });
    }

    // Lấy loại quiz
    const quizResult = await pool.query("SELECT type FROM quizzes WHERE quiz_id = $1", [quiz_id]);
    if (quizResult.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy quiz này." });
    }

    const quizType = quizResult.rows[0].type;

    if (submittedType && submittedType !== quizType) {
      return res.status(400).json({
        error: `Sai loại quiz. Quiz trong DB là '${quizType}', nhưng bạn gửi '${submittedType}'.`,
      });
    }

    // Validate theo loại quiz
    let finalOptions = null;
    let finalCorrectIndex = null;
    let finalExpectedKeywords = null;

    if (quizType === "trac_nghiem") {
      if (!options || correct_index === undefined) {
        return res.status(400).json({
          error: "Câu hỏi trắc nghiệm cần có trường 'options' và 'correct_index'.",
        });
      }
      let optionList;
      try {
        optionList = Array.isArray(options) ? options : JSON.parse(options);
      } catch (err) {
        return res.status(400).json({ error: "Trường 'options' phải là một mảng các đáp án." });
      }
      if (!Array.isArray(optionList)) {
        return res.status(400).json({ error: "Trường 'options' phải là một mảng các đáp án." });
      }
      if (!Number.isInteger(correct_index) || correct_index < 1 || correct_index > optionList.length) {
        return res.status(400).json({
          error: "correct_index phải là số nguyên nằm trong khoảng từ 1 đến số lượng đáp án.",
        });
      }
      finalOptions = JSON.stringify(optionList);
      finalCorrectIndex = correct_index - 1;
    } else if (quizType === "tu_luan") {
      finalExpectedKeywords = expected_keywords || null;
    } else {
      return res.status(400).json({ error: `Loại quiz không hợp lệ: ${quizType}` });
    }

    // Kiểm tra trùng lặp
    const checkExisting = await pool.query(
      "SELECT 1 FROM quiz_questions WHERE quiz_id = $1 AND question = $2",
      [quiz_id, question]
    );
    if (checkExisting.rows.length > 0) {
      return res.status(400).json({ error: "Câu hỏi này đã tồn tại trong quiz." });
    }

    // Insert
    const result = await pool.query(
      `INSERT INTO quiz_questions (quiz_id, question, options, correct_index, expected_keywords, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [quiz_id, question, finalOptions, finalCorrectIndex, finalExpectedKeywords]
    );

    res.status(201).json({
      message: `Câu hỏi đã được thêm thành công. Loại quiz là '${quizType}'.`,
      data: result.rows[0],
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Lỗi khi thêm câu hỏi: " + err.message });
  }
};

module.exports = createQuestion;
