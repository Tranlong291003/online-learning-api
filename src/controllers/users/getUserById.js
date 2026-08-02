const { pool } = require("../../config/db.config");

const getUserById = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT
        uid,
        email,
        name,
        avatar_url,
        bio,
        phone,
        gender,
        birthdate,
        role,
        is_active,
        created_at,
        updated_at
      FROM users
      WHERE uid = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }

    res.json({
      message: "Thông tin người dùng",
      user: result.rows[0],
    });
  } catch (err) {
    console.error("Error in getUserById:", err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = getUserById;
