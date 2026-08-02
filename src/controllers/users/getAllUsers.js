const { pool } = require("../../config/db.config");

const getAllUsers = async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Bạn không có quyền xem danh sách người dùng" });
  }

  try {
    const result = await pool.query(`
      SELECT
        uid,
        name,
        avatar_url,
        role,
        bio,
        is_active
      FROM users
    `);

    res.json({
      message: "Danh sách người dùng",
      users: result.rows,
    });
  } catch (err) {
    console.error("Error in getAllUsers:", err);
    res.status(500).json({ error: "Lỗi khi lấy danh sách người dùng: " + err.message });
  }
};

module.exports = getAllUsers;
