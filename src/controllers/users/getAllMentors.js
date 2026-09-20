const { pool } = require("../../config/db.config");
const { sendServerError } = require("../../utils/errorResponse");

const getAllMentors = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        uid,
        name,
        avatar_url,
        bio,
        email
      FROM users
      WHERE role = 'mentor' AND is_active = true
      ORDER BY name ASC
    `);

    res.json({
      message: "Danh sách mentor",
      mentors: result.rows,
    });
  } catch (err) {
    console.error("Error in getAllMentors:", err);
    sendServerError(res, "Lỗi khi lấy danh sách mentor", err);
  }
};

module.exports = getAllMentors;
