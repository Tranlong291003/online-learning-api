const { pool } = require("../../config/db.config");
const { parsePositiveInt } = require("../../utils/parseId");
const { resolveActorUid } = require("../../middleware/actor");
const { canManageQuestion } = require("../../utils/access");

const updateQuestion = async (req, res) => {
  // Tham số phải là số nguyên dương; chuỗi lạ sẽ khiến PostgreSQL ném lỗi
  // "invalid input syntax for type bigint" → 500 thay vì 400.
  const question_id = parsePositiveInt(req.params.question_id);
  const {
    type: submittedType,
    question,
    options,
    correct_index,
    expected_keywords,
  } = req.body;

  if (!question_id) {
    return res.status(400).json({ message: "question_id không hợp lệ" });
  }

  // Lấy uid từ token; chỉ admin mới được thao tác thay người khác
  const uid = resolveActorUid(req, res, req.body.uid);
  if (!uid) return;

  try {
    // Kiểm tra quyền: role phải là admin/mentor VÀ mentor chỉ được sửa câu hỏi
    // trong quiz do chính mình tạo.
    //
    // Bảng quiz_questions không có cột chủ sở hữu nên quyền suy ra từ quiz chứa
    // nó. Trước đây chỉ kiểm tra role, nên mentor02 sửa được câu hỏi trong quiz
    // của mentor01 (endpoint xoá có kiểm tra, endpoint sửa thì thiếu).
    if (req.user.role !== "admin" && req.user.role !== "mentor") {
      return res.status(403).json({ error: "Bạn không có quyền cập nhật câu hỏi" });
    }

    const access = await canManageQuestion(question_id, req.user);
    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    const questionData = await pool.query(
      `SELECT qq.question_id, qq.quiz_id, qq.question, qq.options, qq.correct_index, qq.expected_keywords
       FROM quiz_questions qq WHERE qq.question_id = $1`,
      [question_id]
    );

    const currentQuestion = questionData.rows[0];
    const quiz_id = currentQuestion.quiz_id;

    // Loại quiz đã có sẵn từ bước kiểm tra quyền.
    const quizType = access.quiz.quiz_type;

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
