const { sql, poolPromise } = require("../../config/db.config");

const createQuiz = async (req, res) => {
  const { course_id, title, type, time_limit, attempt_limit, uid } = req.body;

  if (!course_id || !title) {
    return res
      .status(400)
      .json({ error: "Thiếu thông tin khóa học hoặc tiêu đề" });
  }

  if (!uid) {
    return res.status(400).json({ error: "UID không hợp lệ" });
  }

  try {
    const pool = await poolPromise;
    const request = new sql.Request(pool);

    // Kiểm tra vai trò người dùng
    request.input("uid", sql.NVarChar, uid);
    const roleResult = await request.query(`
      SELECT role FROM users WHERE uid = @uid
    `);
    const role = roleResult.recordset[0]?.role;

    if (role !== "admin" && role !== "giang_vien") {
      return res
        .status(403)
        .json({ error: "Bạn không có quyền tạo bài kiểm tra" });
    }

    // Gán dữ liệu input
    request.input("course_id", sql.Int, course_id);
    request.input("title", sql.NVarChar, title);
    request.input("type", sql.NVarChar, type || "trac_nghiem");
    request.input("time_limit", sql.Int, time_limit || null);
    request.input("attempt_limit", sql.Int, attempt_limit || null);
    request.input("creator_uid", sql.NVarChar, uid);

    // Tạo quiz
    await request.query(`
      INSERT INTO quizzes (
        course_id, title, type, time_limit, attempt_limit, creator_uid, created_at
      ) VALUES (
        @course_id, @title, @type, @time_limit, @attempt_limit, @creator_uid, GETDATE()
      )
    `);

    // Lấy quiz vừa tạo (theo title + creator_uid + course_id + mới nhất)
    const fetchRequest = new sql.Request(pool);
    fetchRequest.input("course_id", sql.Int, course_id);
    fetchRequest.input("title", sql.NVarChar, title);
    fetchRequest.input("creator_uid", sql.NVarChar, uid);

    const result = await fetchRequest.query(`
      SELECT TOP 1 *
      FROM quizzes
      WHERE course_id = @course_id AND title = @title AND creator_uid = @creator_uid
      ORDER BY created_at DESC
    `);

    // Trim khoảng trắng dư (nếu có)
    const quiz = result.recordset[0];
    if (quiz?.creator_uid) {
      quiz.creator_uid = quiz.creator_uid.trim();
    }

    res.status(201).json({
      message: "Tạo bài kiểm tra thành công",
      data: quiz,
    });
  } catch (err) {
    res.status(500).json({ error: "Lỗi khi tạo bài kiểm tra: " + err.message });
  }
};

module.exports = createQuiz;
