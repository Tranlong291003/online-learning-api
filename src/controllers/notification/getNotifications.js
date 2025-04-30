const { sql, poolPromise } = require("../../config/db.config");

const getNotifications = async (req, res) => {
  const { uid } = req.query; // Lấy uid từ query string

  try {
    const pool = await poolPromise;
    // Lấy thông báo mới nhất theo noti_id hoặc created_at
    const result = await pool
      .request()
      .input("uid", sql.NVarChar, uid)
      .query(
        "SELECT TOP 1 * FROM notifications WHERE uid = @uid ORDER BY created_at DESC"
      ); // Lấy thông báo mới nhất

    if (result.recordset.length === 0) {
      return res.status(404).send({ message: "Không có thông báo nào" });
    }

    res.status(200).json(result.recordset[0]); // Trả về thông báo mới nhất
  } catch (error) {
    console.log("Lỗi khi lấy thông báo:", error);
    res.status(500).send({ message: "Không thể lấy thông báo" });
  }
};

module.exports = getNotifications;
