const { pool } = require("../../config/db.config");

const checkUserStatus = async (req, res) => {
  const { uid } = req.params;

  try {
    const result = await pool.query(
      "SELECT is_active FROM users WHERE uid = $1",
      [uid]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }

    res.json({ is_active: result.rows[0].is_active });
  } catch (err) {
    console.error("Error in checkUserStatus:", err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = checkUserStatus;
