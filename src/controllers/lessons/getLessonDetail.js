// controllers/lessons/getLessonDetail.js
// Lay chi tiet mot bai hoc theo lesson_id.
const { selectRows, supabaseAdmin } = require("../../services/supabase.service");

const getLessonDetail = async (req, res) => {
  try {
    const { lesson_id } = req.params;
    if (!lesson_id || isNaN(Number(lesson_id)))
      return res.status(400).json({ error: "lesson_id không hợp lệ" });

    const { data: lesson, error } = await selectRows(
      supabaseAdmin, "lessons", "*",
      { eq: { lesson_id: Number(lesson_id) }, single: true }
    );
    if (error) throw error;
    if (!lesson) return res.status(404).json({ error: "Không tìm thấy bài học" });

    let creator = null;
    if (lesson.creator_uid) {
      const { data: u } = await supabaseAdmin
        .from("users")
        .select("uid, name, avatar_url, bio")
        .eq("uid", lesson.creator_uid)
        .maybeSingle();
      creator = u || null;
    }

    res.status(200).json({
      message: "Lấy chi tiết bài học thành công",
      data: { ...lesson, creator },
    });
  } catch (err) {
    console.error("getLessonDetail error:", err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = getLessonDetail;
