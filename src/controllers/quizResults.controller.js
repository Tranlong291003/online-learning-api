const { sql, poolConnect, pool } = require("../config/db.config");

// Nộp bài làm
exports.submitQuizResult = async (req, res) => {
  const { user_id, quiz_id, answers, score, explanation } = req.body;

  if (!user_id || !quiz_id || !answers) {
    return res
      .status(400)
      .json({ error: "Thiếu thông tin người dùng, quiz hoặc câu trả lời" });
  }

  try {
    const pool = await poolConnect; // Đảm bảo kết nối đã được thiết lập
    const request = new sql.Request(pool);
    request.input("user_id", sql.Int, user_id);
    request.input("quiz_id", sql.Int, quiz_id);
    request.input("answers", sql.NVarChar, JSON.stringify(answers));
    request.input("score", sql.Float, score || 0);
    request.input("explanation", sql.NVarChar, explanation || "");

    // Lưu kết quả bài làm vào bảng quiz_results
    await request.query(
      "INSERT INTO quiz_results (user_id, quiz_id, answers, score, explanation, submitted_at, status) " +
        "VALUES (@user_id, @quiz_id, @answers, @score, @explanation, GETDATE(), 'cho_cham')"
    );

    res.status(201).json({ message: "Bài làm đã được nộp thành công" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi khi nộp bài làm: " + err.message });
  }
};

// Lấy kết quả chi tiết bài làm
exports.getQuizResultById = async (req, res) => {
  const { id } = req.params; // result_id từ URL

  try {
    const pool = await poolConnect; // Đảm bảo kết nối đã được thiết lập
    const request = new sql.Request(pool);
    request.input("result_id", sql.Int, id);

    const result = await request.query(
      "SELECT * FROM quiz_results WHERE result_id = @result_id"
    );

    if (result.recordset.length === 0) {
      return res
        .status(404)
        .json({ error: "Không tìm thấy kết quả bài làm này" });
    }

    res.json({
      message: "Kết quả bài làm",
      data: result.recordset[0],
    });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: "Lỗi khi lấy kết quả bài làm: " + err.message });
  }
};

// Lấy kết quả của người học
exports.getResultsByUser = async (req, res) => {
  const { id } = req.params; // user_id từ URL

  try {
    const pool = await poolConnect; // Đảm bảo kết nối đã được thiết lập
    const request = new sql.Request(pool);
    request.input("user_id", sql.Int, id);

    const result = await request.query(
      "SELECT * FROM quiz_results WHERE user_id = @user_id"
    );

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: "Người dùng chưa có kết quả nào" });
    }

    res.json({
      message: "Kết quả của người học",
      data: result.recordset,
    });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: "Lỗi khi lấy kết quả người học: " + err.message });
  }
};

// Chấm bài tự luận
exports.gradeQuizResult = async (req, res) => {
  const { id } = req.params; // result_id từ URL
  const { explanation, score, graded_by } = req.body;

  if (!explanation || score === undefined || !graded_by) {
    return res
      .status(400)
      .json({ error: "Thiếu thông tin chấm điểm hoặc giải thích" });
  }

  try {
    const pool = await poolConnect; // Đảm bảo kết nối đã được thiết lập
    const request = new sql.Request(pool);
    request.input("result_id", sql.Int, id);
    request.input("explanation", sql.NVarChar, explanation);
    request.input("score", sql.Float, score);
    request.input("graded_by", sql.Int, graded_by);

    const result = await request.query(
      "UPDATE quiz_results SET explanation = @explanation, score = @score, status = 'da_cham', graded_by = @graded_by, graded_at = GETDATE() WHERE result_id = @result_id"
    );

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: "Kết quả không tồn tại" });
    }

    res.status(200).json({ message: "Chấm điểm bài kiểm tra thành công" });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: "Lỗi khi chấm điểm bài kiểm tra: " + err.message });
  }
};
