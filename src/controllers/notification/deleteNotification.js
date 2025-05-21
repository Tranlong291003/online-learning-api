const { sql, poolPromise } = require("../../config/db.config");

const deleteNotification = async (req, res) => {
  const { uid } = req.body; // Lấy uid từ body
  const notiId = req.params.id;

  if (!uid) {
    return res.status(400).json({ error: "Thiếu uid" });
  }

  try {
    const pool = await poolPromise;
    // Xóa thông báo chỉ khi nó thuộc về user đó
    const result = await pool
      .request()
      .input("noti_id", sql.Int, notiId)
      .input("uid", sql.NVarChar, uid)
      .query(
        "DELETE FROM notifications WHERE noti_id = @noti_id AND uid = @uid"
      );

    if (result.rowsAffected > 0) {
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
