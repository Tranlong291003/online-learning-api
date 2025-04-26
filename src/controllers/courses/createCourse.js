const { sql, poolPromise } = require("../../config/db.config");
const path = require("path");

const createCourse = async (req, res) => {
  const {
    title,
    description,
    category_id,
    level,
    price,
    discount_price,
    status,
    language,
    tags,
    uid, // instructor_uid
  } = req.body;

  if (!title || !category_id) {
    return res.status(400).json({ error: "Tên và danh mục là bắt buộc" });
  }

  if (!uid) {
    return res.status(400).json({ error: "UID không được bỏ trống" });
  }

  try {
    const pool = await poolPromise;
    const request = new sql.Request(pool);

    request.input("uid", sql.NVarChar, uid);
    const userQuery = await request.query(
      `SELECT name, role FROM users WHERE uid = @uid`
    );

    if (userQuery.recordset.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }

    const { name: instructor_name, role: userRole } = userQuery.recordset[0];

    if (userRole !== "admin" && userRole !== "mentor") {
      return res.status(403).json({ error: "Bạn không có quyền tạo khóa học" });
    }

    const finalStatus = status || "chua_duyet";

    // Xử lý ảnh thumbnail nếu có
    let thumbnail_url = null;
    if (req.file) {
      thumbnail_url = `/uploads/courses/${req.file.filename}`;
    }

    // Gán input
    request.input("title", sql.NVarChar, title);
    request.input("description", sql.NVarChar, description || null);
    request.input("instructor_uid", sql.NVarChar, uid);
    request.input("category_id", sql.Int, category_id);
    request.input("level", sql.NVarChar, level || null);
    request.input("price", sql.Int, price || null);
    request.input("discount_price", sql.Int, discount_price || null);
    request.input("status", sql.NVarChar, finalStatus);
    request.input("language", sql.NVarChar, language || null);
    request.input("tags", sql.NVarChar, tags || null);
    request.input("thumbnail_url", sql.NVarChar, thumbnail_url);

    await request.query(`
      INSERT INTO courses (
        title,
        description,
        instructor_uid,
        category_id,
        level,
        price,
        discount_price,
        status,
        language,
        tags,
        thumbnail_url,
        created_at,
        updated_at
      )
      VALUES (
        @title,
        @description,
        @instructor_uid,
        @category_id,
        @level,
        @price,
        @discount_price,
        @status,
        @language,
        @tags,
        @thumbnail_url,
        GETDATE(),
        GETDATE()
      )
    `);

    const courseQuery = await request.query(`
      SELECT * FROM courses
      WHERE title = @title AND instructor_uid = @uid
      ORDER BY created_at DESC
    `);

    const course = courseQuery.recordset[0];

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
