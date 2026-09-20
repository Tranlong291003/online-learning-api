const { pool } = require("../../config/db.config");
const { resolveActorUid } = require("../../middleware/actor");

const createNotification = async (req, res) => {
  const { title, content, icon, color } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: "Thiếu title hoặc content" });
  }

  // Lấy uid từ token; chỉ admin mới được tạo thông báo cho người khác
  const uid = resolveActorUid(req, res, req.body.uid);
  if (!uid) return;

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
