const { sql, poolPromise } = require("../../config/db.config");

const getNotifications = async (req, res) => {
  const { uid } = req.body; // Lấy uid từ body

  if (!uid) {
    return res.status(400).json({ error: "Thiếu uid" });
  }

  try {
    const pool = await poolPromise;
    // Lấy tất cả thông báo của user, sắp xếp theo thời gian tạo mới nhất
    const result = await pool
      .request()
      .input("uid", sql.NVarChar, uid)
      .query(
        "SELECT noti_id, uid, title, content, icon, color, is_read, created_at FROM notifications WHERE uid = @uid ORDER BY created_at DESC"
      );

    if (result.recordset.length === 0) {
      return res.status(200).json({ notifications: [] });
    }

    res.status(200).json({ notifications: result.recordset });
  } catch (error) {
    console.log("Lỗi khi lấy thông báo:", error);
    res.status(500).send({ message: "Không thể lấy thông báo" });
  }
};

module.exports = getNotifications;
