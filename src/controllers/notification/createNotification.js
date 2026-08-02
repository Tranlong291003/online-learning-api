const { pool } = require("../../config/db.config");

const createNotification = async (req, res) => {
  const { uid, title, content, icon, color } = req.body;

  if (!uid || !title || !content) {
    return res.status(400).json({ error: "Thiếu uid, title hoặc content" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO notifications (uid, title, content, icon, color, is_read, created_at)
       VALUES ($1, $2, $3, $4, $5, false, NOW())
       RETURNING noti_id, uid, title, content, icon, color, is_read, created_at`,
      [uid, title, content, icon, color]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.log("Lỗi khi tạo thông báo:", error);
    res.status(500).send({ message: "Không thể tạo thông báo" });
  }
};

module.exports = createNotification;
