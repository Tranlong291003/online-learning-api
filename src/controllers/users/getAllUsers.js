const { sql, poolPromise } = require("../../config/db.config");
const admin = require("../../config/firebase.config"); // Firebase Admin SDK

const getAllUsers = async (req, res) => {
  try {
    // 1) Lấy ConnectionPool từ poolPromise
    const pool = await poolPromise;

    // 2) Tạo Request từ pool và chạy query
    const result = await pool.request().query(`
        SELECT
          uid,
          name,
        avatar_url,
          role,
          bio,
          is_active
        FROM users
      `);

    // 3) Trả về kết quả
    res.json({
      message: "Danh sách người dùng",
      users: result.recordset,
    });
  } catch (err) {
    console.error("Error in getAllUsers:", err);
    res
      .status(500)
      .json({ error: "Lỗi khi lấy danh sách người dùng: " + err.message });
  }
};

module.exports = getAllUsers;
