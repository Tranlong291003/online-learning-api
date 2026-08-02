const { pool } = require("../../config/db.config");

const createCourse = async (req, res) => {
  const {
    title,
    description,
    category_id,
    level,
    price,
    discount_price,
    language,
    tags,
    uid,
  } = req.body;

  if (!title || !category_id) {
    return res.status(400).json({ error: "Tên và danh mục là bắt buộc" });
  }

  if (!uid) {
    return res.status(400).json({ error: "UID không được bỏ trống" });
  }

  try {
    // Kiểm tra user và role
    const userResult = await pool.query(
      "SELECT name, role FROM users WHERE uid = $1",
      [uid]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }

    const { name: instructor_name, role: userRole } = userResult.rows[0];

    if (userRole !== "admin" && userRole !== "mentor") {
      return res.status(403).json({ error: "Bạn không có quyền tạo khóa học" });
    }

    // Xử lý thumbnail
    let thumbnail_url = null;
    if (req.file) {
      thumbnail_url = `/uploads/courses/${req.file.filename}`;
    }

    // Insert course
    const insertResult = await pool.query(
      `INSERT INTO courses (
        title, description, instructor_uid, category_id, level,
        price, discount_price, status, rejection_reason, language,
        tags, thumbnail_url, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
      RETURNING *`,
      [
        title,
        description || null,
        uid,
        category_id,
        level || null,
        price ?? null,
        discount_price ?? null,
        "pending",
        null,
        language || null,
        tags || null,
        thumbnail_url,
      ]
    );

    const course = insertResult.rows[0];

    res.status(201).json({
      message: "Tạo khóa học mới thành công",
      course: {
        ...course,
        instructor_name,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Lỗi tạo khóa học: " + err.message });
  }
};

module.exports = createCourse;
