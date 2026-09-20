const { pool } = require("../../config/db.config");
const { resolveActorUid } = require("../../middleware/actor");

// noti_id là UUID trong DB nên KHÔNG ép về số — nhưng vẫn phải kiểm tra định
// dạng. Nếu để nguyên, giá trị rác ("abc") khiến PostgreSQL ném lỗi
// "invalid input syntax for type uuid" và trả 500, trong khi lỗi thật là
// "client gửi sai" nên phải là 400.
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const updateNotification = async (req, res) => {
  const notiId = req.params.id;

  if (!notiId) {
    return res.status(400).json({ error: "Thiếu noti_id" });
  }

  if (!UUID_PATTERN.test(String(notiId).trim())) {
    return res.status(400).json({ error: "noti_id không hợp lệ" });
  }

  // Lấy uid từ token; chỉ admin mới được thao tác thay người khác
  const uid = resolveActorUid(req, res, req.body?.uid);
  if (!uid) return;

  try {
    const result = await pool.query(
      "UPDATE notifications SET is_read = true WHERE noti_id = $1 AND uid = $2 RETURNING noti_id",
      [notiId, uid]
    );

    if (result.rows.length > 0) {
      res.status(200).send({ message: "Đã đánh dấu thông báo là đã đọc" });
    } else {
      res.status(404).send({ message: "Không tìm thấy thông báo" });
    }
  } catch (error) {
    console.log("Lỗi khi cập nhật thông báo:", error);
    res.status(500).send({ message: "Không thể cập nhật thông báo" });
  }
};

module.exports = updateNotification;
