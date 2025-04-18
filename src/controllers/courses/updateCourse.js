// controllers/courseCategories/updateCourse.js
const { sql, poolPromise } = require("../../config/db.config");

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
    thumbnail_url,
    uid, // Thêm UID vào để kiểm tra quyền người dùng
  } = req.body;

  try {
    const pool = await poolPromise; // Sử dụng poolPromise để kết nối
    const request = new sql.Request(pool);

    // Truy vấn vai trò của người dùng
    request.input("uid", sql.NVarChar, uid);
    const roleQuery = await request.query(
      `SELECT role FROM users WHERE uid = @uid`
    );

    const userRole = roleQuery.recordset[0]?.role;

    // Kiểm tra quyền của người dùng
    if (userRole !== "admin" && userRole !== "giang_vien") {
      return res.status(403).json({ error: "Bạn không có quyền sửa khóa học" });
    }

    // 1. Lấy dữ liệu hiện tại của khóa học
    request.input("course_id", sql.Int, course_id);
    const currentResult = await request.query(`
      SELECT * FROM courses WHERE course_id = @course_id
    `);

    if (currentResult.recordset.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy khóa học" });
    }

    const current = currentResult.recordset[0];

    // 2. Merge với dữ liệu mới (nếu không truyền thì giữ nguyên giá trị cũ)
    const updatedTitle = title ?? current.title;
    const updatedDescription = description ?? current.description;
    const updatedLevel = level ?? current.level;
    const updatedPrice = price ?? current.price;
    const updatedDiscountPrice = discount_price ?? current.discount_price;
    const updatedLanguage = language ?? current.language;
    const updatedTags = tags ?? current.tags;
    const updatedThumbnailUrl = thumbnail_url ?? current.thumbnail_url;

    // 3. Chuẩn bị query để cập nhật khóa học
    const updateRequest = new sql.Request(pool);
    updateRequest.input("course_id", sql.Int, course_id);
    updateRequest.input("title", sql.NVarChar, updatedTitle);
    updateRequest.input("description", sql.NVarChar, updatedDescription);
    updateRequest.input("level", sql.NVarChar, updatedLevel);
    updateRequest.input("price", sql.Int, updatedPrice);
    updateRequest.input("discount_price", sql.Int, updatedDiscountPrice);
    updateRequest.input("language", sql.NVarChar, updatedLanguage);
    updateRequest.input("tags", sql.NVarChar, updatedTags);
    updateRequest.input("thumbnail_url", sql.NVarChar, updatedThumbnailUrl);

    // Thực hiện cập nhật khóa học
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

    // Lấy thông tin khóa học đã cập nhật
    const finalResult = await updateRequest.query(`
      SELECT * FROM courses WHERE course_id = @course_id
    `);

    // Trả về thông tin khóa học sau khi cập nhật
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
