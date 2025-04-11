// controllers/questionController.js
const { sql, poolConnect } = require("../config/db.config");

exports.getQuestionsByQuiz = async (req, res) => {
  const { quiz_id } = req.params; // quiz_id từ URL

  try {
    const pool = await poolConnect; // Đảm bảo kết nối đã được thiết lập
    const request = new sql.Request(pool);

    // Kiểm tra quiz có tồn tại hay không
    request.input("quiz_id", sql.Int, quiz_id);
    const quizResult = await request.query(
      "SELECT quiz_id FROM quizzes WHERE quiz_id = @quiz_id"
    );

    if (quizResult.recordset.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy quiz này" });
    }

    // Lấy toàn bộ câu hỏi của quiz
    const questionResult = await request.query(
      "SELECT * FROM quiz_questions WHERE quiz_id = @quiz_id"
    );

    if (questionResult.recordset.length === 0) {
      return res
        .status(404)
        .json({ error: "Không tìm thấy câu hỏi cho bài kiểm tra này" });
    }

    // Trả về danh sách câu hỏi
    return res.json({
      message: "Danh sách câu hỏi của bài kiểm tra",
      data: questionResult.recordset,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "Lỗi khi lấy danh sách câu hỏi: " + err.message,
    });
  }
};

exports.createQuestion = async (req, res) => {
  const {
    quiz_id,
    question,
    type: submittedType,
    options,
    correct_index,
    expected_keywords,
  } = req.body;

  // Kiểm tra dữ liệu bắt buộc
  if (!quiz_id || !question) {
    return res.status(400).json({
      error: "Thiếu thông tin bài kiểm tra (quiz_id) hoặc câu hỏi (question).",
    });
  }

  try {
    const pool = await poolConnect; // Đảm bảo kết nối đã được thiết lập
    const request = new sql.Request(pool);

    // Truyền quiz_id vào tham số cho câu truy vấn
    request.input("quiz_id", sql.Int, quiz_id);

    // Lấy loại quiz dựa trên quiz_id
    const quizResult = await request.query(`
      SELECT [type]
      FROM quizzes
      WHERE quiz_id = @quiz_id
    `);

    // Kiểm tra quiz có tồn tại không
    if (quizResult.recordset.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy quiz này." });
    }

    // Lấy kiểu quiz (trac_nghiem / tu_luan) từ DB
    const quizType = quizResult.recordset[0].type;

    // (Tuỳ chọn) So sánh với type do client gửi lên để đảm bảo khớp:
    if (submittedType && submittedType !== quizType) {
      return res.status(400).json({
        error: `Sai loại quiz. Quiz trong DB là '${quizType}', nhưng bạn gửi '${submittedType}'.`,
      });
    }

    // Hiển thị tạm trên log để theo dõi (hoặc trả về response)
    console.log("Loại quiz (type) từ DB:", quizType);

    // Tuỳ theo loại quiz từ DB mà thực hiện logic ràng buộc
    if (quizType === "trac_nghiem") {
      // Bắt buộc phải có options và correct_index
      if (!options || correct_index === undefined) {
        return res.status(400).json({
          error:
            "Câu hỏi trắc nghiệm cần có trường 'options' và 'correct_index'.",
        });
      }

      request.input("question", sql.NVarChar, question);
      // Nếu options là mảng, nên stringify khi lưu:
      request.input("options", sql.NVarChar, JSON.stringify(options));
      request.input("correct_index", sql.Int, correct_index);
      request.input("expected_keywords", sql.NVarChar, null);
    } else if (quizType === "tu_luan") {
      // Nếu là tự luận, chỉ dùng expected_keywords (tùy chọn)
      request.input(
        "expected_keywords",
        sql.NVarChar,
        expected_keywords || null
      );
      request.input("options", sql.NVarChar, null);
      request.input("correct_index", sql.Int, null);
      request.input("question", sql.NVarChar, question);
    } else {
      // Nếu DB trả về loại quiz ngoài 2 loại trên, báo lỗi (nếu cần)
      return res.status(400).json({
        error: `Loại quiz không hợp lệ: ${quizType}`,
      });
    }

    // Kiểm tra xem câu hỏi đã tồn tại chưa
    const checkExistingQuestion = await request.query(`
      SELECT *
      FROM quiz_questions
      WHERE quiz_id = @quiz_id
        AND question = @question
    `);

    if (checkExistingQuestion.recordset.length > 0) {
      return res.status(400).json({
        error: "Câu hỏi này đã tồn tại trong quiz.",
      });
    }

    // Thêm câu hỏi mới
    await request.query(`
      INSERT INTO quiz_questions (
        quiz_id, question, options, correct_index, expected_keywords, created_at
      )
      VALUES (
        @quiz_id, @question, @options, @correct_index, @expected_keywords, GETDATE()
      )
    `);

    // Lấy lại thông tin câu hỏi vừa thêm
    const result = await request.query(`
      SELECT *
      FROM quiz_questions
      WHERE quiz_id = @quiz_id
        AND question = @question
    `);

    // Trả kết quả, kèm thông tin loại quiz
    return res.status(201).json({
      message: `Câu hỏi đã được thêm thành công. Loại quiz là '${quizType}'.`,
      data: result.recordset[0],
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "Lỗi khi thêm câu hỏi: " + err.message,
    });
  }
};

exports.updateQuestion = async (req, res) => {
  const { question_id } = req.params; // Lấy question_id từ URL
  const {
    type: submittedType, // nếu client có gửi kèm để so sánh
    question,
    options,
    correct_index,
    expected_keywords,
  } = req.body;

  try {
    // 1. Lấy thông tin câu hỏi dựa trên question_id
    const pool = await poolConnect;
    const request = new sql.Request(pool);

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
exports.deleteQuestion = async (req, res) => {
  const { question_id } = req.params; // question_id từ URL

  try {
    const pool = await poolConnect; // Đảm bảo kết nối đã được thiết lập
    const request = new sql.Request(pool);
    request.input("question_id", sql.Int, question_id);

    const result = await request.query(
      "DELETE FROM quiz_questions WHERE question_id = @question_id"
    );

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: "Câu hỏi không tồn tại" });
    }

    res.status(200).json({ message: "Xóa câu hỏi thành công" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi khi xóa câu hỏi: " + err.message });
  }
};
