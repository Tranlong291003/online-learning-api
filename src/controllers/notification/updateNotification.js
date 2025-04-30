const { sql, poolPromise } = require("../../config/db.config");

const updateNotification = async (req, res) => {
  const notiId = req.params.id;

  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("noti_id", sql.UniqueIdentifier, notiId)
      .query("UPDATE notifications SET is_read = 1 WHERE noti_id = @noti_id");

    if (result.rowsAffected > 0) {
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
