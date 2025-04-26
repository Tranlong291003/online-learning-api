const { sql, poolPromise } = require("../../config/db.config");
const path = require("path");

const updateCourse = async (req, res) => {
  const { course_id } = req.params;
  const {
    title,
    description,
    level,
    price,
    discount_price,
    language,
    tags,
    uid, // người cập nhật
  } = req.body;

  try {
    const pool = await poolPromise;
    const request = new sql.Request(pool);

    request.input("uid", sql.NVarChar, uid);
    const roleQuery = await request.query(`
      SELECT role FROM users WHERE uid = @uid
    `);

    const userRole = roleQuery.recordset[0]?.role;

    if (userRole !== "admin" && userRole !== "mentor") {
      return res.status(403).json({ error: "Bạn không có quyền sửa khóa học" });
    }

    // Lấy dữ liệu khóa học hiện tại
    request.input("course_id", sql.Int, course_id);
    const currentResult = await request.query(`
      SELECT * FROM courses WHERE course_id = @course_id
    `);

    if (currentResult.recordset.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy khóa học" });
    }

    const current = currentResult.recordset[0];

    // Nếu có ảnh mới → dùng ảnh mới, còn không thì giữ nguyên
    const newThumbnailUrl = req.file
      ? `/uploads/courses/${req.file.filename}`
      : current.thumbnail_url;

    // Merge dữ liệu
    const updatedTitle = title ?? current.title;
    const updatedDescription = description ?? current.description;
    const updatedLevel = level ?? current.level;
    const updatedPrice = price ?? current.price;
    const updatedDiscountPrice = discount_price ?? current.discount_price;
    const updatedLanguage = language ?? current.language;
    const updatedTags = tags ?? current.tags;

    const updateRequest = new sql.Request(pool);
    updateRequest.input("course_id", sql.Int, course_id);
    updateRequest.input("title", sql.NVarChar, updatedTitle);
    updateRequest.input("description", sql.NVarChar, updatedDescription);
    updateRequest.input("level", sql.NVarChar, updatedLevel);
    updateRequest.input("price", sql.Int, updatedPrice);
    updateRequest.input("discount_price", sql.Int, updatedDiscountPrice);
    updateRequest.input("language", sql.NVarChar, updatedLanguage);
    updateRequest.input("tags", sql.NVarChar, updatedTags);
    updateRequest.input("thumbnail_url", sql.NVarChar, newThumbnailUrl);

    await updateRequest.query(`
      UPDATE courses
      SET
        title = @title,
        description = @description,
        level = @level,
        price = @price,
        discount_price = @discount_price,
        language = @language,
        tags = @tags,
        thumbnail_url = @thumbnail_url,
        updated_at = GETDATE()
      WHERE course_id = @course_id
    `);

    const finalResult = await updateRequest.query(`
      SELECT * FROM courses WHERE course_id = @course_id
    `);

    res.status(200).json({
      message: "Cập nhật khóa học thành công",
      data: finalResult.recordset[0],
    });
  } catch (err) {
    res.status(500).json({
      error: "Lỗi cập nhật khóa học: " + err.message,
    });
  }
};

module.exports = updateCourse;
