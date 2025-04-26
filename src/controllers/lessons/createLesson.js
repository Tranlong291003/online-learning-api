const { sql, poolPromise } = require("../../config/db.config");
const path = require("path");

const createLesson = async (req, res) => {
  const { course_id, title, video_url, content, order, is_preview, uid } =
    req.body;

  if (!course_id || !title || !uid) {
    return res.status(400).json({
      error: "Các trường course_id, title và uid là bắt buộc",
    });
  }

  try {
    const pool = await poolPromise;
    const request = new sql.Request(pool);

    // Kiểm tra vai trò người dùng
    request.input("uid", sql.NVarChar, uid);
    const roleQuery = await request.query(`
      SELECT role FROM users WHERE uid = @uid
    `);

    const userRole = roleQuery.recordset[0]?.role;
    if (userRole !== "admin" && userRole !== "mentor") {
      return res.status(403).json({ error: "Bạn không có quyền tạo bài học" });
    }

    // Kiểm tra khóa học tồn tại
    request.input("course_id", sql.Int, course_id);
    const courseCheck = await request.query(`
      SELECT course_id FROM courses WHERE course_id = @course_id
    `);

    if (courseCheck.recordset.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy khóa học" });
    }

    // Xử lý file PDF và Slide (nếu có)
    const pdf_url = req.files?.pdf?.[0]?.filename
      ? `/uploads/lessons/pdf/${req.files.pdf[0].filename}`
      : null;

    const slide_url = req.files?.slide?.[0]?.filename
      ? `/uploads/lessons/slides/${req.files.slide[0].filename}`
      : null;

    // Gán dữ liệu input
    // Gán dữ liệu input
    request.input("title", sql.NVarChar, title);
    request.input("video_url", sql.NVarChar, video_url || null);
    request.input("pdf_url", sql.NVarChar, pdf_url);
    request.input("slide_url", sql.NVarChar, slide_url);
    request.input("content", sql.NVarChar, content || null);
    request.input("order", sql.Int, order || null);
    request.input(
      "is_preview",
      sql.Bit,
      is_preview === "true" || is_preview === true
    );
    request.input("creator_uid", sql.NVarChar, uid); // ✅ Thêm dòng này

    // Thêm mới bài học
    await request.query(`
      INSERT INTO lessons (
        course_id,
        title,
        video_url,
        pdf_url,
        slide_url,
        content,
        [order],
        is_preview,
        creator_uid,
        created_at
      ) VALUES (
        @course_id,
        @title,
        @video_url,
        @pdf_url,
        @slide_url,
        @content,
        @order,
        @is_preview,
        @creator_uid,
        GETDATE()
      )
    `);

    // Lấy bài học vừa tạo
    const result = await request.query(`
      SELECT * FROM lessons
      WHERE course_id = @course_id AND title = @title
      ORDER BY created_at DESC
    `);

    res.status(201).json({
      message: "Tạo bài học thành công",
      data: result.recordset[0],
    });
  } catch (err) {
    res.status(500).json({
      error: "Lỗi tạo bài học: " + err.message,
    });
  }
};

module.exports = createLesson;
