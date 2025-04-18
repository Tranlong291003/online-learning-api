const { sql, poolConnect, pool } = require("../../config/db.config");
const admin = require("../../config/firebase.config"); // Firebase Admin SDK

const deleteUser = async (req, res) => {
  const { id } = req.params; // user_id từ URL

  try {
    const pool = await poolConnect; // Đảm bảo kết nối đã được thiết lập
    const request = new sql.Request(pool);

    // Lấy thông tin người dùng (Firebase UID) từ cơ sở dữ liệu
    request.input("user_id", sql.Int, id);
    const result = await request.query(
      "SELECT firebase_uid FROM users WHERE user_id = @user_id"
    );

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }

    const firebaseUid = result.recordset[0].firebase_uid;

    // Xóa người dùng trong Firebase Authentication
    await admin.auth().deleteUser(firebaseUid);

    // Xóa người dùng trong cơ sở dữ liệu SQL Server
    await request.query("DELETE FROM users WHERE user_id = @user_id");

    res.json({ message: "Người dùng đã được xóa thành công" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi khi xóa người dùng: " + err.message });
  }
};

module.exports = deleteUser;
