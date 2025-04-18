const { sql, poolConnect, pool } = require("../../config/db.config");

const submitQuizResult = async (req, res) => {
  const { user_id, quiz_id, answers, score, explanation } = req.body;

  if (!user_id || !quiz_id || !answers) {
    return res
      .status(400)
      .json({ error: "Thiếu thông tin người dùng, quiz hoặc câu trả lời" });
  }

  try {
    const pool = await poolConnect; // Đảm bảo kết nối đã được thiết lập
    const request = new sql.Request(pool);

    // Khai báo tham số @user_id, @quiz_id và các tham số khác
    request.input("user_id", sql.Int, user_id);
    request.input("quiz_id", sql.Int, quiz_id);
    request.input("answers", sql.NVarChar, JSON.stringify(answers));
    request.input("score", sql.Float, score || 0);
    request.input("explanation", sql.NVarChar, explanation || "");

    // Lấy loại quiz (trac_nghiem)
    const quizResult = await request.query(
      "SELECT [type] FROM quizzes WHERE quiz_id = @quiz_id"
    );

    if (quizResult.recordset.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy quiz này" });
    }

    const quizType = quizResult.recordset[0].type;

    // Nếu quiz là trắc nghiệm (trac_nghiem), tính điểm tự động
    if (quizType === "trac_nghiem") {
      // Lấy danh sách câu hỏi và đáp án đúng từ bảng quiz_questions
      const questions = await request.query(
        "SELECT question_id, correct_index FROM quiz_questions WHERE quiz_id = @quiz_id"
      );

      let calculatedScore = 0;
      questions.recordset.forEach((question, index) => {
        const userAnswer = answers[index]; // Đáp án của người học

        // So sánh đáp án người học với đáp án đúng
        if (userAnswer === question.correct_index) {
          calculatedScore += 1; // Tăng điểm nếu đúng
        }
      });

      // Nếu không có điểm được tính trong body, sử dụng điểm đã tính
      const finalScore = score || calculatedScore;
      request.input("finalScore", sql.Float, finalScore);

      // Lưu kết quả bài làm vào bảng quiz_results với finalScore
      await request.query(
        "INSERT INTO quiz_results (user_id, quiz_id, answers, score, explanation, submitted_at, status) " +
          "VALUES (@user_id, @quiz_id, @answers, @finalScore, @explanation, GETDATE(), 'da_cham')"
      );

      res
        .status(201)
        .json({ message: "Bài làm đã được nộp thành công", score: finalScore });
    } else {
      // Nếu loại quiz không phải trắc nghiệm, chỉ lưu điểm đã được gửi
      await request.query(
        "INSERT INTO quiz_results (user_id, quiz_id, answers, score, explanation, submitted_at, status) " +
          "VALUES (@user_id, @quiz_id, @answers, @score, @explanation, GETDATE(), 'cho_cham')"
      );

      res.status(201).json({ message: "Bài làm đã được nộp thành công" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi khi nộp bài làm: " + err.message });
  }
};
module.exports = submitQuizResult;
