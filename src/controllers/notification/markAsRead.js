const { pool } = require("../../config/db.config");

const markAsRead = async (req, res) => {
  const { uid, noti_id } = req.body;

  if (!uid || !noti_id) {
    return res.status(400).json({ error: "Thiếu uid hoặc noti_id" });
  }

  try {
    const result = await pool.query(
      "UPDATE notifications SET is_read = true WHERE noti_id = $1 AND uid = $2 RETURNING noti_id",
      [noti_id, uid]
    );

    if (result.rows.length > 0) {
      res.status(200).send({ message: "Đã đánh dấu thông báo là đã đọc" });
    } else {
      res.status(404).send({
        message: "Không tìm thấy thông báo hoặc bạn không có quyền cập nhật",
      });
    }
  } catch (error) {
    console.log("Lỗi khi cập nhật trạng thái thông báo:", error);
    res.status(500).send({ message: "Không thể cập nhật trạng thái thông báo" });
  }
};

module.exports = markAsRead;
