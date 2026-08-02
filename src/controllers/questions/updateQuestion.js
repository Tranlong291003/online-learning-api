const { pool } = require("../../config/db.config");

const updateQuestion = async (req, res) => {
  const { question_id } = req.params;
  const {
    type: submittedType,
    question,
    options,
    correct_index,
    expected_keywords,
    uid,
  } = req.body;

  if (!uid) {
    return res.status(400).json({ error: "UID không hợp lệ" });
  }

  try {
    // Kiểm tra quyền
    const roleResult = await pool.query("SELECT role FROM users WHERE uid = $1", [uid]);
    const userRole = roleResult.rows[0]?.role;

    if (userRole !== "admin" && userRole !== "mentor") {
      return res.status(403).json({ error: "Bạn không có quyền cập nhật câu hỏi" });
    }

    // Lấy thông tin câu hỏi
    const questionData = await pool.query(
      `SELECT qq.question_id, qq.quiz_id, qq.question, qq.options, qq.correct_index, qq.expected_keywords
       FROM quiz_questions qq WHERE qq.question_id = $1`,
      [question_id]
    );

    if (questionData.rows.length === 0) {
      return res.status(404).json({ message: "Câu hỏi không tồn tại hoặc đã bị xóa." });
    }

    const currentQuestion = questionData.rows[0];
    const quiz_id = currentQuestion.quiz_id;

    // Lấy loại quiz
    const quizResult = await pool.query("SELECT type FROM quizzes WHERE quiz_id = $1", [quiz_id]);
    if (quizResult.rows.length === 0) {
      return res.status(404).json({ message: "Quiz tương ứng với câu hỏi không tồn tại." });
    }

    const quizType = quizResult.rows[0].type;

    if (submittedType && submittedType !== quizType) {
      return res.status(400).json({
        message: `Sai loại quiz. Quiz trong DB là '${quizType}', nhưng bạn gửi '${submittedType}'.`,
      });
    }

    // Validate theo loại quiz
    if (quizType === "trac_nghiem") {
      if (!options || correct_index === undefined) {
        return res.status(400).json({ message: "Câu hỏi trắc nghiệm cần có 'options' và 'correct_index'." });
      }
    }

    // Kiểm tra trùng lặp
    if (question) {
      const duplicateCheck = await pool.query(
        "SELECT question_id FROM quiz_questions WHERE quiz_id = $1 AND question = $2 AND question_id <> $3",
        [quiz_id, question, question_id]
      );
      if (duplicateCheck.rows.length > 0) {
        return res.status(400).json({ message: "Câu hỏi này đã tồn tại trong quiz." });
      }
    }

    // Chuẩn bị dữ liệu
    let finalOptions = null;
    let finalCorrectIndex = null;
    let finalExpectedKeywords = null;

    if (quizType === "trac_nghiem") {
      if (!options || correct_index === undefined) {
        return res.status(400).json({ message: "Câu hỏi trắc nghiệm cần có 'options' và 'correct_index'." });
      }
      let optionList;
      try {
        optionList = Array.isArray(options) ? options : JSON.parse(options);
      } catch (err) {
        return res.status(400).json({ message: "Trường 'options' phải là một mảng các đáp án." });
      }
      if (!Array.isArray(optionList)) {
        return res.status(400).json({ message: "Trường 'options' phải là một mảng các đáp án." });
      }
      if (!Number.isInteger(correct_index) || correct_index < 1 || correct_index > optionList.length) {
        return res.status(400).json({
          message: "correct_index phải là số nguyên nằm trong khoảng từ 1 đến số lượng đáp án.",
        });
      }
      finalOptions = JSON.stringify(optionList);
      finalCorrectIndex = correct_index - 1;
    } else {
      finalExpectedKeywords = expected_keywords !== undefined ? expected_keywords : currentQuestion.expected_keywords;
    }

    // Update
    const updateResult = await pool.query(
      `UPDATE quiz_questions SET
        question = $1,
        options = $2,
        correct_index = $3,
        expected_keywords = $4,
        updated_at = NOW()
      WHERE question_id = $5
      RETURNING *`,
      [question || currentQuestion.question, finalOptions, finalCorrectIndex, finalExpectedKeywords, question_id]
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ message: "Cập nhật không thành công. Câu hỏi có thể đã bị xóa." });
    }

    return res.status(200).json({
      message: `Cập nhật câu hỏi thành công. Loại quiz là '${quizType}'.`,
      data: updateResult.rows[0],
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Đã xảy ra lỗi khi cập nhật câu hỏi. Vui lòng thử lại sau." });
  }
};

module.exports = updateQuestion;
