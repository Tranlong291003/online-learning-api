const { sql, poolPromise } = require("../../config/db.config");

const getCoursesByUser = async (req, res) => {
  try {
    const { user_id } = req.params; // Dùng user_id trong URL
    const pool = await poolPromise; // Sử dụng poolPromise để kết nối
    const request = new sql.Request(pool);
    request.input("user_id", sql.Int, user_id);

    const result = await request.query(
      "SELECT * FROM enrollments WHERE user_id = @user_id"
    );

    res.json({
      message: "📚 Danh sách khóa học đã đăng ký",
      data: result.recordset,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = getCoursesByUser;
