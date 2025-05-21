// controllers/mentor.controller.js

const { sql, poolPromise } = require("../../config/db.config");

/**
 * GET /api/mentors
 * Query Parameters:
 *   - search (optional): partial match on name or phone
 */
const getAllMentors = async (req, res) => {
  try {
    const { search } = req.query;
    const pool = await poolPromise;
    const request = pool.request();

    // Bắt buộc chỉ lấy những user có role = 'mentor'
    // Chỉ định rõ độ dài NVarChar để không bị cắt giá trị
    request.input("role", sql.NVarChar(50), "mentor");

    // Câu truy vấn cơ bản
    let query = `
      SELECT
        uid,
        name,
        phone,
        avatar_url,
        bio,
        role,
        is_active
      FROM users
      WHERE role = @role
    `;

    // Nếu có tham số tìm kiếm, thêm điều kiện LIKE
    if (search) {
      request.input("searchParam", sql.NVarChar(sql.MAX), `%${search}%`);
      query += `
        AND (
          name  LIKE @searchParam
          OR phone LIKE @searchParam
        )
      `;
    }

    // Thực thi query
    const result = await request.query(query);

    // Trả về JSON với thông điệp tiếng Việt
    res.json({
      message: "Danh sách mentor",
      mentors: result.recordset.map((m) => ({
        uid: m.uid,
        name: m.name,
        phone: m.phone,
        avatar_url: m.avatar_url,
        bio: m.bio,
        role: m.role,
        isActive: m.is_active,
      })),
    });
  } catch (err) {
    console.error("Error fetching mentors list:", err);
    res.status(500).json({
      error: "Lỗi khi lấy danh sách mentor: " + err.message,
    });
  }
};

module.exports = getAllMentors;
