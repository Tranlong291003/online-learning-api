const { sql, poolPromise } = require("../../config/db.config");

const createQuiz = async (req, res) => {
  const {
    course_id,
    title,
    type,
    time_limit,
    passing_score,
    attempt_limit,
    uid,
  } = req.body;

  if (!course_id || !title) {
    return res
      .status(400)
      .json({ error: "Thiếu thông tin khóa học hoặc tiêu đề bài kiểm tra" });
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

    // Kiểm tra quyền tạo bài kiểm tra (Admin hoặc Giảng viên)
    if (userRole !== "admin" && userRole !== "giang_vien") {
      return res.status(403).json({
        error: "Bạn không có quyền tạo bài kiểm tra",
      });
    }

    // Thêm bài kiểm tra mới
    request.input("course_id", sql.Int, course_id);
    request.input("title", sql.NVarChar, title);
    request.input("type", sql.NVarChar, type || "trac_nghiem");
    request.input("time_limit", sql.Int, time_limit);
    request.input("passing_score", sql.Int, passing_score);
    request.input("attempt_limit", sql.Int, attempt_limit);

    await request.query(
      "INSERT INTO quizzes (course_id, title, type, time_limit, passing_score, attempt_limit, created_at) " +
        "VALUES (@course_id, @title, @type, @time_limit, @passing_score, @attempt_limit, GETDATE())"
    );

    // Lấy thông tin bài kiểm tra đã được tạo
    const newQuiz = await request.query(
      "SELECT * FROM quizzes WHERE course_id = @course_id AND title = @title"
    );

    res.status(201).json({
      message: "Bài kiểm tra đã được tạo thành công",
      data: newQuiz.recordset[0], // Trả về bài kiểm tra vừa tạo
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi khi tạo bài kiểm tra: " + err.message });
  }
};

module.exports = createQuiz;
