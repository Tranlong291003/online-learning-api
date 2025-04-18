const { sql, poolPromise } = require("../../config/db.config");

const updateQuestion = async (req, res) => {
  const { question_id } = req.params; // Lấy question_id từ URL
  const {
    type: submittedType, // nếu client có gửi kèm để so sánh
    question,
    options,
    correct_index,
    expected_keywords,
    uid, // UID để kiểm tra quyền người dùng
  } = req.body;

  if (!uid) {
    return res.status(400).json({ error: "UID không hợp lệ" });
  }

  try {
    const pool = await poolPromise; // Sử dụng poolPromise để kết nối
    const request = new sql.Request(pool);

    // Kiểm tra quyền của người dùng
    request.input("uid", sql.NVarChar, uid);
    const roleQuery = await request.query(
      `SELECT role FROM users WHERE uid = @uid`
    );

    const userRole = roleQuery.recordset[0]?.role;

    // Kiểm tra quyền cập nhật câu hỏi (Admin hoặc Giảng viên)
    if (userRole !== "admin" && userRole !== "giang_vien") {
      return res.status(403).json({
        error: "Bạn không có quyền cập nhật câu hỏi",
      });
    }

    // 1. Lấy thông tin câu hỏi dựa trên question_id
    request.input("question_id", sql.Int, question_id);
    const questionData = await request.query(`
      SELECT qq.question_id, qq.quiz_id, qq.question,
             qq.options, qq.correct_index, qq.expected_keywords
      FROM quiz_questions qq
      WHERE qq.question_id = @question_id
    `);

    if (questionData.recordset.length === 0) {
      return res.status(404).json({
        message: "Câu hỏi không tồn tại hoặc đã bị xóa.",
      });
    }

    // Lấy quiz_id từ câu hỏi để xác định quiz
    const currentQuestion = questionData.recordset[0];
    const quiz_id = currentQuestion.quiz_id;

    // 2. Kiểm tra quiz có tồn tại và lấy type
    request.input("quiz_id", sql.Int, quiz_id);
    const quizResult = await request.query(`
      SELECT [type]
      FROM quizzes
      WHERE quiz_id = @quiz_id
    `);

    if (quizResult.recordset.length === 0) {
      return res.status(404).json({
        message: "Quiz tương ứng với câu hỏi không tồn tại.",
      });
    }

    const quizType = quizResult.recordset[0].type;

    // 3. So sánh với submittedType (nếu client gửi lên)
    if (submittedType && submittedType !== quizType) {
      return res.status(400).json({
        message: `Sai loại quiz. Quiz trong DB là '${quizType}', nhưng bạn gửi '${submittedType}'.`,
      });
    }

    // 4. Áp dụng ràng buộc tuỳ loại quiz
    if (quizType === "trac_nghiem") {
      // Bắt buộc phải có options và correct_index
      if (!options || correct_index === undefined) {
        return res.status(400).json({
          message: "Câu hỏi trắc nghiệm cần có 'options' và 'correct_index'.",
        });
      }
    } else if (quizType === "tu_luan") {
      // Tự luận chỉ cần expected_keywords, còn lại để null
      // (Tuỳ theo bạn có bắt buộc expected_keywords hay không)
      // Ví dụ: nếu bạn muốn bắt buộc
      // if (!expected_keywords) {
      //   return res.status(400).json({
      //     message: "Câu hỏi tự luận cần có 'expected_keywords'."
      //   });
      // }
    } else {
      return res.status(400).json({
        message: `Loại quiz không hợp lệ: ${quizType}`,
      });
    }

    // 5. Kiểm tra trùng lặp câu hỏi (question) trong cùng quiz,
    //    ngoại trừ chính câu hỏi này (question_id hiện tại)
    if (question) {
      request.input("new_question", sql.NVarChar, question);
      const duplicateCheck = await request.query(`
        SELECT question_id
        FROM quiz_questions
        WHERE quiz_id = @quiz_id
          AND question = @new_question
          AND question_id <> @question_id
      `);
      if (duplicateCheck.recordset.length > 0) {
        return res.status(400).json({
          message: "Câu hỏi này đã tồn tại trong quiz.",
        });
      }
    }

    // 6. Chuẩn bị tham số cập nhật
    // - Trắc nghiệm => lưu options, correct_index; expected_keywords = null
    // - Tự luận => lưu expected_keywords; options, correct_index = null
    // - Tùy bạn muốn cho phép sửa "question" hay không; ở đây cho phép.
    let finalOptions = null;
    let finalCorrectIndex = null;
    let finalExpectedKeywords = null;

    if (quizType === "trac_nghiem") {
      // stringify options nếu nó là array/object
      finalOptions = options ? JSON.stringify(options) : null;
      finalCorrectIndex = correct_index;
      // Tự luận => null
      finalExpectedKeywords = null;
    } else {
      // tu_luan
      finalOptions = null;
      finalCorrectIndex = null;
      finalExpectedKeywords = expected_keywords || null;
    }

    request.input(
      "updated_question",
      sql.NVarChar,
      question || currentQuestion.question
    );
    request.input("updated_options", sql.NVarChar, finalOptions);
    request.input("updated_correct_index", sql.Int, finalCorrectIndex);
    request.input(
      "updated_expected_keywords",
      sql.NVarChar,
      finalExpectedKeywords
    );

    // 7. Thực hiện UPDATE
    const updateResult = await request.query(`
      UPDATE quiz_questions
      SET
        question = @updated_question,
        options = @updated_options,
        correct_index = @updated_correct_index,
        expected_keywords = @updated_expected_keywords,
        updated_at = GETDATE()
      WHERE question_id = @question_id
    `);

    if (updateResult.rowsAffected[0] === 0) {
      return res.status(404).json({
        message: "Cập nhật không thành công. Câu hỏi có thể đã bị xóa.",
      });
    }

    // 8. Lấy lại dữ liệu sau update
    const updatedData = await request.query(`
      SELECT *
      FROM quiz_questions
      WHERE question_id = @question_id
    `);

    // 9. Trả về kết quả
    return res.status(200).json({
      message: `Cập nhật câu hỏi thành công. Loại quiz là '${quizType}'.`,
      data: updatedData.recordset[0],
    });
  } catch (err) {
    console.error(err);
    // Không hiển thị lỗi chi tiết, chỉ báo chung chung
    return res.status(500).json({
      message: "Đã xảy ra lỗi khi cập nhật câu hỏi. Vui lòng thử lại sau.",
    });
  }
};

module.exports = updateQuestion;
