const { pool } = require("../../config/db.config");
const path = require("path");
const fs = require("fs");
const { resolveActorUid } = require("../../middleware/actor");

const updateLesson = async (req, res) => {
  const { lesson_id } = req.params;
  const { title, video_url, content, order } = req.body;

  // Lấy uid từ token; chỉ admin mới được thao tác thay người khác
  const uid = resolveActorUid(req, res, req.body.uid);
  if (!uid) return;

  try {
    // Kiểm tra vai trò
    const roleResult = await pool.query(
      "SELECT role FROM users WHERE uid = $1",
      [uid]
    );
    const userRole = roleResult.rows[0]?.role;

    if (userRole !== "admin" && userRole !== "mentor") {
      return res.status(403).json({ error: "Bạn không có quyền cập nhật bài học" });
    }

    // Lấy dữ liệu hiện tại
    const currentResult = await pool.query(
      "SELECT * FROM lessons WHERE lesson_id = $1",
      [lesson_id]
    );

    if (currentResult.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy bài học" });
    }

    const current = currentResult.rows[0];

    // Mentor chỉ được sửa bài học do mình tạo (giống deleteLesson).
    // Không kiểm tra thì mentor bất kỳ sửa được nội dung bài học của mentor khác.
    if (userRole === "mentor" && current.creator_uid !== uid) {
      return res.status(403).json({ error: "Bạn chỉ được cập nhật bài học do bạn tạo" });
    }

    // Xử lý file
    let newPdfUrl = current.pdf_url;
    let newSlideUrl = current.slide_url;

    if (req.files?.pdf?.[0]) {
      if (current.pdf_url) {
        const oldPdfPath = path.join(__dirname, "../../public", current.pdf_url);
        if (fs.existsSync(oldPdfPath)) fs.unlinkSync(oldPdfPath);
      }
      newPdfUrl = `/uploads/lessons/pdf/${req.files.pdf[0].filename}`;
    }

    if (req.files?.slide?.[0]) {
      if (current.slide_url) {
        const oldSlidePath = path.join(__dirname, "../../public", current.slide_url);
        if (fs.existsSync(oldSlidePath)) fs.unlinkSync(oldSlidePath);
      }
      newSlideUrl = `/uploads/lessons/slides/${req.files.slide[0].filename}`;
    }

    // Merge dữ liệu
    const updatedTitle = title ?? current.title;
    const updatedVideoUrl = video_url ?? current.video_url;
    const updatedContent = content ?? current.content;
    const updatedOrder = order ?? current.order;

    // Update
    const updateResult = await pool.query(
      `UPDATE lessons SET
        title = $1,
        video_url = $2,
        pdf_url = $3,
        slide_url = $4,
        content = $5,
        "order" = $6,
        updated_at = NOW()
      WHERE lesson_id = $7
      RETURNING *`,
      [updatedTitle, updatedVideoUrl, newPdfUrl, newSlideUrl, updatedContent, updatedOrder, lesson_id]
    );

    res.status(200).json({
      message: "Cập nhật bài học thành công",
      data: updateResult.rows[0],
    });
  } catch (err) {
    res.status(500).json({ error: "Lỗi cập nhật bài học: " + err.message });
  }
};

module.exports = updateLesson;
