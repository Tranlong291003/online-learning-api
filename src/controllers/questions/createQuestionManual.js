const { sql, poolPromise } = require("../../config/db.config");

const createQuestion = async (req, res) => {
  const {
    quiz_id,
    question,
    type: submittedType,
    options,
    correct_index,
    expected_keywords,
    uid, // UID để kiểm tra quyền người dùng
  } = req.body;

  // Kiểm tra dữ liệu bắt buộc
  if (!quiz_id || !question) {
    return res.status(400).json({
      error: "Thiếu thông tin bài kiểm tra (quiz_id) hoặc câu hỏi (question).",
    });
  }

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

    // Kiểm tra quyền tạo câu hỏi (Admin hoặc Giảng viên)
    if (userRole !== "admin" && userRole !== "mentor") {
      return res.status(403).json({
        error: "Bạn không có quyền tạo câu hỏi",
      });
    }

    // Truy vấn lấy loại quiz
    request.input("quiz_id", sql.Int, quiz_id);
    const quizResult = await request.query(`
      SELECT [type]
      FROM quizzes
      WHERE quiz_id = @quiz_id
    `);

    // Kiểm tra quiz có tồn tại không
    if (quizResult.recordset.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy quiz này." });
    }

    // Lấy kiểu quiz từ DB
    const quizType = quizResult.recordset[0].type;

    // So sánh với type do client gửi lên để đảm bảo khớp:
    if (submittedType && submittedType !== quizType) {
      return res.status(400).json({
        error: `Sai loại quiz. Quiz trong DB là '${quizType}', nhưng bạn gửi '${submittedType}'.`,
      });
    }

    // Kiểm tra loại quiz và thực hiện xử lý tương ứng
    if (quizType === "trac_nghiem") {
      // Bắt buộc phải có options và correct_index
      if (!options || correct_index === undefined) {
        return res.status(400).json({
          error:
            "Câu hỏi trắc nghiệm cần có trường 'options' và 'correct_index'.",
        });
      }

      request.input("question", sql.NVarChar, question);
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
      // Nếu loại quiz không hợp lệ
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

    // Thêm câu hỏi mới vào quiz
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

    res.status(201).json({
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

module.exports = createQuestion;
