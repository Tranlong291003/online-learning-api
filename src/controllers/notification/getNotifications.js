const { pool } = require("../../config/db.config");

const getNotifications = async (req, res) => {
  const { uid } = req.body;

  if (!uid) {
    return res.status(400).json({ error: "Thiếu uid" });
  }

  try {
    const result = await pool.query(
      `SELECT noti_id, uid, title, content, icon, color, is_read, created_at
       FROM notifications
       WHERE uid = $1
       ORDER BY created_at DESC`,
      [uid]
    );

    if (result.rows.length === 0) {
      return res.status(200).json({ notifications: [] });
    }

    res.status(200).json({ notifications: result.rows });
  } catch (error) {
    console.log("Lỗi khi lấy thông báo:", error);
    res.status(500).send({ message: "Không thể lấy thông báo" });
  }
};

module.exports = getNotifications;
