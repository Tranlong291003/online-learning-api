const { sql, poolPromise } = require("../../config/db.config");

const deleteNotification = async (req, res) => {
  const notiId = req.params.id;

  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("noti_id", sql.UniqueIdentifier, notiId)
      .query("DELETE FROM notifications WHERE noti_id = @noti_id");

    if (result.rowsAffected > 0) {
      res.status(200).send({ message: "Thông báo đã bị xóa" });
    } else {
      res.status(404).send({ message: "Không tìm thấy thông báo" });
    }
  } catch (error) {
    console.log("Lỗi khi xóa thông báo:", error);
    res.status(500).send({ message: "Không thể xóa thông báo" });
  }
};

module.exports = deleteNotification;
