const { pool } = require("../../config/db.config");

const deleteNotification = async (req, res) => {
  const { uid } = req.body;
  const notiId = req.params.id;

  if (!uid) {
    return res.status(400).json({ error: "Thiếu uid" });
  }

  try {
    const result = await pool.query(
      "DELETE FROM notifications WHERE noti_id = $1 AND uid = $2 RETURNING noti_id",
      [notiId, uid]
    );

    if (result.rows.length > 0) {
      res.status(200).send({ message: "Thông báo đã bị xóa" });
    } else {
      res.status(404).send({
        message: "Không tìm thấy thông báo hoặc bạn không có quyền xóa",
      });
    }
  } catch (error) {
    console.log("Lỗi khi xóa thông báo:", error);
    res.status(500).send({ message: "Không thể xóa thông báo" });
  }
};

module.exports = deleteNotification;
