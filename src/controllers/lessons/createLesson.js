const { sql, poolPromise } = require("../../config/db.config");

const createLesson = async (req, res) => {
  const {
    course_id,
    title,
    video_url,
    pdf_url,
    slide_url,
    content,
    order,
    is_preview,
    uid, // UID để kiểm tra quyền người dùng
  } = req.body;

  if (!course_id || !title) {
    return res.status(400).json({
      error: "Các trường course_id và title là bắt buộc",
    });
  }

  try {
    const pool = await poolPromise; // Sử dụng poolPromise để kết nối
    const request = new sql.Request(pool);

    // Kiểm tra quyền của người dùng
    if (!uid) {
      return res.status(400).json({ error: "UID không hợp lệ" });
    }

    // Kiểm tra vai trò của người dùng
    request.input("uid", sql.NVarChar, uid);
    const roleQuery = await request.query(
      `SELECT role FROM users WHERE uid = @uid`
    );

    const userRole = roleQuery.recordset[0]?.role;

    // Kiểm tra quyền tạo bài học (Admin hoặc Giảng viên)
    if (userRole !== "admin" && userRole !== "giang_vien") {
      return res.status(403).json({
        error: "Bạn không có quyền tạo bài học",
      });
    }

    // 1. Lấy dữ liệu khóa học hiện tại (nếu có)
    request.input("course_id_param", sql.Int, course_id); // Thay đổi tên tham số
    const currentResult = await request.query(`
      SELECT * FROM courses WHERE course_id = @course_id_param
    `);

    if (currentResult.recordset.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy khóa học" });
    }

    // 2. Merge với dữ liệu mới (nếu không truyền thì giữ nguyên giá trị cũ)
    const updatedTitle = title ?? currentResult.recordset[0].title;
    const updatedVideoUrl = video_url ?? null;
    const updatedPdfUrl = pdf_url ?? null;
    const updatedSlideUrl = slide_url ?? null;
    const updatedContent = content ?? null;
    const updatedOrder = order ?? null;
    const updatedIsPreview =
      typeof is_preview === "boolean" ? is_preview : null;

    // 3. Thực hiện truy vấn thêm bài học vào bảng lessons
    request.input("title_param", sql.NVarChar, updatedTitle); // Thay đổi tên tham số
    request.input("video_url_param", sql.NVarChar, updatedVideoUrl); // Thay đổi tên tham số
    request.input("pdf_url_param", sql.NVarChar, updatedPdfUrl); // Thay đổi tên tham số
    request.input("slide_url_param", sql.NVarChar, updatedSlideUrl); // Thay đổi tên tham số
    request.input("content_param", sql.NVarChar, updatedContent); // Thay đổi tên tham số
    request.input("order_param", sql.Int, updatedOrder); // Thay đổi tên tham số
    request.input("is_preview_param", sql.Bit, updatedIsPreview); // Thay đổi tên tham số

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
        created_at
      )
      VALUES (
        @course_id_param,  -- Thay đổi tên tham số
        @title_param,  -- Thay đổi tên tham số
        @video_url_param,  -- Thay đổi tên tham số
        @pdf_url_param,  -- Thay đổi tên tham số
        @slide_url_param,  -- Thay đổi tên tham số
        @content_param,  -- Thay đổi tên tham số
        @order_param,  -- Thay đổi tên tham số
        @is_preview_param,  -- Thay đổi tên tham số
        GETDATE()
      )
    `);

    // Lấy thông tin bài học vừa được tạo
    const lessonResult = await request.query(`
      SELECT * FROM lessons
      WHERE course_id = @course_id_param
      AND title = @title_param
    `);

    const createdLesson = lessonResult.recordset[0]; // Thông tin bài học mới tạo

    // Trả về kết quả thành công cùng với thông tin bài học
    res.status(201).json({
      message: "Tạo bài học mới thành công",
      data: createdLesson,
    });
  } catch (err) {
    res.status(500).json({
      error: "Lỗi tạo bài học: " + err.message,
    });
  }
};

module.exports = createLesson;
