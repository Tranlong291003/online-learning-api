// controllers/lessons/updateLesson.js
// Mentor cap nhat bai hoc (title, video, pdf, slide, content, order).
const { updateRows, selectRows, supabaseAdmin } = require("../../services/supabase.service");

const updateLesson = async (req, res) => {
  try {
    const { lesson_id } = req.params;
    if (!lesson_id || isNaN(Number(lesson_id)))
      return res.status(400).json({ error: "lesson_id không hợp lệ" });

    const updater_uid = req.supabaseUser?.authUser?.id;
    const role = req.supabaseUser?.profile?.role;
    if (!updater_uid) return res.status(401).json({ error: "Chưa đăng nhập" });

    const { data: lesson, error: findErr } = await selectRows(
      supabaseAdmin, "lessons", "lesson_id,creator_uid",
      { eq: { lesson_id: Number(lesson_id) }, single: true }
    );
    if (findErr) throw findErr;
    if (!lesson) return res.status(404).json({ error: "Không tìm thấy bài học" });
    if (role !== "admin" && lesson.creator_uid !== updater_uid) {
      return res.status(403).json({ error: "Bạn không có quyền sửa bài học này" });
    }

    const allowed = ["title", "video_url", "video_id", "video_duration", "pdf_url", "slide_url", "content", "order"];
    const patch = {};
    for (const k of allowed) if (req.body[k] !== undefined) patch[k] = req.body[k];
    if (patch.title !== undefined) {
      if (!patch.title || !patch.title.trim())
        return res.status(400).json({ error: "Tiêu đề không được để trống" });
      patch.title = patch.title.trim();
    }
    if (Object.keys(patch).length === 0)
      return res.status(400).json({ error: "Không có trường nào để cập nhật" });
    patch.updated_at = new Date().toISOString();

    const { data: updated, error: updErr } = await updateRows(
      supabaseAdmin, "lessons", patch, { lesson_id: Number(lesson_id) }
    );
    if (updErr) throw updErr;

    res.status(200).json({
      message: "Cập nhật bài học thành công",
      data: updated && updated[0] ? updated[0] : null,
    });
  } catch (err) {
    console.error("updateLesson error:", err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = updateLesson;
