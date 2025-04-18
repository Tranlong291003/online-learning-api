const { sql, poolConnect, pool } = require("../../config/db.config");
const admin = require("../../config/firebase.config"); // Firebase Admin SDK

const getAllUsers = async (req, res) => {
  try {
    const pool = await poolConnect; // Đảm bảo kết nối đã được thiết lập
    const request = new sql.Request(pool);

    // Truy vấn danh sách người dùng
    const result = await request.query(
      "SELECT user_id, display_name, email, role FROM users"
    );

    res.json({
      message: "Danh sách người dùng",
      data: result.recordset,
    });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: "Lỗi khi lấy danh sách người dùng: " + err.message });
  }
};

module.exports = getAllUsers;
