const { sql, poolConnect, pool } = require("../../config/db.config");
const admin = require("../../config/firebase.config"); // Firebase Admin SDK

const getUserById = async (req, res) => {
  const { id } = req.params; // user_id từ URL

  try {
    const pool = await poolConnect; // Đảm bảo kết nối đã được thiết lập
    const request = new sql.Request(pool);

    // Truy vấn thông tin chi tiết người dùng
    request.input("user_id", sql.Int, id);
    const result = await request.query(
      "SELECT * FROM users WHERE user_id = @user_id"
    );

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }

    res.json({
      message: "Chi tiết người dùng",
      data: result.recordset[0],
    });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: "Lỗi khi lấy chi tiết người dùng: " + err.message });
  }
};

module.exports = getUserById;
