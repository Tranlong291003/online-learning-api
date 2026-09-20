const { pool } = require("../../config/db.config");
const { resolveActorUid } = require("../../middleware/actor");

const getNotifications = async (req, res) => {
  // Chấp nhận uid ở query (GET) hoặc body (POST) cho tương thích FE
  const claimedUid =
    (req.query && req.query.uid) || (req.body && req.body.uid);

  // Lấy uid từ token; chỉ admin mới được xem thông báo của người khác
  const uid = resolveActorUid(req, res, claimedUid);
  if (!uid) return;

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
