// controllers/lessons/deleteLesson.js
// Mentor xoa bai hoc (cascade xoa lesson_progress theo schema FK ON DELETE CASCADE).
const { deleteRows, selectRows, supabaseAdmin } = require("../../services/supabase.service");

const deleteLesson = async (req, res) => {
  try {
    const { lesson_id } = req.params;
    if (!lesson_id || isNaN(Number(lesson_id)))
      return res.status(400).json({ error: "lesson_id không hợp lệ" });

    const user_uid = req.supabaseUser?.authUser?.id;
    const role = req.supabaseUser?.profile?.role;
    if (!user_uid) return res.status(401).json({ error: "Chưa đăng nhập" });

    const { data: lesson, error: findErr } = await selectRows(
      supabaseAdmin, "lessons", "lesson_id,creator_uid",
      { eq: { lesson_id: Number(lesson_id) }, single: true }
    );
    if (findErr) throw findErr;
    if (!lesson) return res.status(404).json({ error: "Không tìm thấy bài học" });
    if (role !== "admin" && lesson.creator_uid !== user_uid) {
      return res.status(403).json({ error: "Bạn không có quyền xóa bài học này" });
    }

    const { error: delErr } = await deleteRows(
      supabaseAdmin, "lessons", { lesson_id: Number(lesson_id) }
    );
    if (delErr) throw delErr;

    res.status(200).json({ message: "Xóa bài học thành công" });
  } catch (err) {
    console.error("deleteLesson error:", err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = deleteLesson;
