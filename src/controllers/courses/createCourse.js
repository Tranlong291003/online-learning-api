const { sql, poolConnect, pool } = require("../../config/db.config");

const createCourse = async (req, res) => {
  const {
    title,
    description,
    instructor_id,
    category_id,
    level,
    price,
    discount_price,
    status, // Có thể có hoặc không
    language,
    tags,
    thumbnail_url,
  } = req.body;

  // Kiểm tra các trường bắt buộc
  if (!title || !instructor_id || !category_id) {
    return res
      .status(400)
      .json({ error: "Tên, giảng viên và danh mục là bắt buộc" });
  }

  try {
    await poolConnect;
    const request = new sql.Request(pool);

    // Nếu status không được gửi lên, gán mặc định là "chua_duyet"
    const finalStatus = status || "chua_duyet";

    // Các input cần thiết
    request.input("title", sql.NVarChar, title);
    request.input("description", sql.NVarChar, description || null);
    request.input("instructor_id", sql.Int, instructor_id);
    request.input("category_id", sql.Int, category_id);
    request.input("level", sql.NVarChar, level || null);
    request.input("price", sql.Int, price || null);
    request.input("discount_price", sql.Int, discount_price || null);
    request.input("status", sql.NVarChar, finalStatus);
    request.input("language", sql.NVarChar, language || null);
    request.input("tags", sql.NVarChar, tags || null);
    request.input("thumbnail_url", sql.NVarChar, thumbnail_url || null);

    // Thực hiện insert
    await request.query(`
      INSERT INTO courses (
        title,
        description,
        instructor_id,
        category_id,
        level,
        price,
        discount_price,
        status,
        language,
        tags,
        thumbnail_url,
        created_at,
        approved_at,
        updated_at
      )
      VALUES (
        @title,
        @description,
        @instructor_id,
        @category_id,
        @level,
        @price,
        @discount_price,
        @status,
        @language,
        @tags,
        @thumbnail_url,
        GETDATE(),
        NULL,
        NULL
      )
    `);

    res.status(201).json({ message: "Tạo khóa học mới thành công" });
  } catch (err) {
    res.status(500).json({ error: "Lỗi tạo khóa học: " + err.message });
  }
};
module.exports = createCourse;
