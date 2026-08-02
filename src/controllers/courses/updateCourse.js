const { pool } = require("../../config/db.config");

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
    uid,
  } = req.body;

  try {
    // Kiểm tra role
    const roleResult = await pool.query(
      "SELECT role FROM users WHERE uid = $1",
      [uid]
    );

    const userRole = roleResult.rows[0]?.role;

    if (userRole !== "admin" && userRole !== "mentor") {
      return res.status(403).json({ error: "Bạn không có quyền sửa khóa học" });
    }

    // Lấy dữ liệu hiện tại
    const currentResult = await pool.query(
      "SELECT * FROM courses WHERE course_id = $1",
      [course_id]
    );

    if (currentResult.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy khóa học" });
    }

    const current = currentResult.rows[0];

    // Mentor chỉ được sửa khóa học của chính mình
    if (userRole === "mentor" && current.instructor_uid !== uid) {
      return res.status(403).json({
        error: "Bạn không có quyền sửa khóa học của người khác",
      });
    }

    // Merge dữ liệu
    const newThumbnailUrl = req.file
      ? `/uploads/courses/${req.file.filename}`
      : current.thumbnail_url;

    const updatedTitle = title ?? current.title;
    const updatedDescription = description ?? current.description;
    const updatedLevel = level ?? current.level;
    const updatedPrice = price ?? current.price;
    const updatedDiscountPrice = discount_price ?? current.discount_price;
    const updatedLanguage = language ?? current.language;
    const updatedTags = tags ?? current.tags;

    // Update
    const updateResult = await pool.query(
      `UPDATE courses
       SET title = $1, description = $2, level = $3, price = $4,
           discount_price = $5, language = $6, tags = $7,
           thumbnail_url = $8, updated_at = NOW()
       WHERE course_id = $9
       RETURNING *`,
      [
        updatedTitle,
        updatedDescription,
        updatedLevel,
        updatedPrice,
        updatedDiscountPrice,
        updatedLanguage,
        updatedTags,
        newThumbnailUrl,
        course_id,
      ]
    );

    res.status(200).json({
      message: "Cập nhật khóa học thành công",
      data: updateResult.rows[0],
    });
  } catch (err) {
    res.status(500).json({
      error: "Lỗi cập nhật khóa học: " + err.message,
    });
  }
};

module.exports = updateCourse;
