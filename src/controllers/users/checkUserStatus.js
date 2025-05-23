const { sql, poolPromise } = require("../../config/db.config");

const checkUserStatus = async (req, res) => {
  const { uid } = req.params;

  if (!uid) {
    return res.status(400).json({
      error: "Thiếu thông tin uid",
    });
  }

  try {
    const pool = await poolPromise;
    const request = new sql.Request(pool);
    request.input("uid", sql.NVarChar, uid);

    const result = await request.query(`
      SELECT is_active
      FROM users
      WHERE uid = @uid
    `);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        error: "Không tìm thấy người dùng",
      });
    }

    const { is_active } = result.recordset[0];

    return res.status(200).json({
      is_active,
    });
  } catch (err) {
    console.error("Lỗi kiểm tra trạng thái người dùng:", err);
    return res.status(500).json({
      error: "Lỗi khi kiểm tra trạng thái người dùng",
    });
  }
};

module.exports = checkUserStatus;
