const { sql, poolConnect, pool } = require("../../config/db.config");
const admin = require("../../config/firebase.config"); // Firebase Admin SDK

const updateUserStatus = async (req, res) => {
  const { id } = req.params; // user_id từ URL
  const { status } = req.body; // Trạng thái: 'active' hoặc 'disabled'

  if (!status || (status !== "active" && status !== "disabled")) {
    return res.status(400).json({ error: "Trạng thái không hợp lệ" });
  }

  try {
    const pool = await poolConnect; // Đảm bảo kết nối đã được thiết lập
    const request = new sql.Request(pool);

    // Cập nhật trạng thái trong cơ sở dữ liệu SQL Server
    request.input("status", sql.NVarChar, status);
    request.input("user_id", sql.Int, id);

    const result = await request.query(
      "UPDATE users SET is_active = @status WHERE user_id = @user_id"
    );

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }

    // Cập nhật trạng thái trong Firebase Authentication
    const user = await admin.auth().getUserByEmail(email);
    if (status === "disabled") {
      await admin.auth().updateUser(user.uid, { disabled: true });
    } else {
      await admin.auth().updateUser(user.uid, { disabled: false });
    }

    res.json({ message: "Trạng thái người dùng đã được cập nhật thành công" });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Lỗi khi cập nhật trạng thái người dùng: " + err.message,
    });
  }
};

module.exports = updateUserStatus;
