const { sql, poolPromise } = require("../../config/db.config");

const markAsRead = async (req, res) => {
  const { uid, noti_id } = req.body;

  if (!uid || !noti_id) {
    return res.status(400).json({ error: "Thiếu uid hoặc noti_id" });
  }

  try {
    const pool = await poolPromise;
    // Cập nhật trạng thái đã đọc cho thông báo của user
    const result = await pool
      .request()
      .input("noti_id", sql.Int, noti_id)
      .input("uid", sql.NVarChar, uid)
      .query(
        "UPDATE notifications SET is_read = 1 WHERE noti_id = @noti_id AND uid = @uid"
      );

    if (result.rowsAffected > 0) {
      res.status(200).send({ message: "Đã đánh dấu thông báo là đã đọc" });
    } else {
      res.status(404).send({
        message: "Không tìm thấy thông báo hoặc bạn không có quyền cập nhật",
      });
    }
  } catch (error) {
    console.log("Lỗi khi cập nhật trạng thái thông báo:", error);
    res
      .status(500)
      .send({ message: "Không thể cập nhật trạng thái thông báo" });
  }
};

module.exports = markAsRead;
