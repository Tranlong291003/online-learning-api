const { sql, poolPromise } = require("../../config/db.config");
const admin = require("../../config/firebase.config"); // Firebase Admin SDK

// Promise-based handler, dùng uid thay cho user_id
const getUserById = async (req, res) => {
  const { id: uid } = req.params; // uid từ URL

  try {
    const pool = await poolPromise;
    const result = await pool.request().input("uid", sql.NVarChar, uid).query(`
        SELECT *
        FROM users
        WHERE uid = @uid
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }

    res.json({
      message: "Chi tiết người dùng",
      user: result.recordset[0],
    });
  } catch (err) {
    console.error("Error in getUserById:", err);
    res
      .status(500)
      .json({ error: "Lỗi khi lấy chi tiết người dùng: " + err.message });
  }
};

module.exports = getUserById;
