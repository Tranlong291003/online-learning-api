// controllers/lessons/getAllLessons.js
// Lay tat ca bai hoc theo course_id, sap xep theo "order".
// Neu co user_uid (auth) se kem is_completed tu lesson_progress.
const { supabaseAdmin } = require("../../services/supabase.service");

const getAllLessons = async (req, res) => {
  try {
    const course_id = req.params.course_id || req.query.course_id;
    const user_uid = req.query.userUid || req.supabaseUser?.authUser?.id;

    if (!course_id || isNaN(Number(course_id)))
      return res.status(400).json({ error: "Tham số course_id không hợp lệ" });

    const { data: lessons, error } = await supabaseAdmin
      .from("lessons")
      .select("*")
      .eq("course_id", Number(course_id))
      .order("order", { ascending: true });
    if (error) throw error;

    if (!lessons || !lessons.length) {
      return res.status(200).json({ message: "Không có bài học cho khóa học này", data: [] });
    }

    let progressMap = {};
    if (user_uid) {
      const lessonIds = lessons.map((l) => l.lesson_id);
      const { data: progress } = await supabaseAdmin
        .from("lesson_progress")
        .select("lesson_id, is_completed")
        .eq("user_uid", user_uid)
        .in("lesson_id", lessonIds);
      for (const p of progress || []) progressMap[p.lesson_id] = p.is_completed;
    }

    const creatorUids = [...new Set(lessons.map((l) => l.creator_uid).filter(Boolean))];
    let creatorMap = {};
    if (creatorUids.length) {
      const { data: users } = await supabaseAdmin
        .from("users")
        .select("uid, name, avatar_url")
        .in("uid", creatorUids);
      for (const u of users || []) creatorMap[u.uid] = u;
    }

    const data = lessons.map((l) => ({
      ...l,
      is_completed: !!progressMap[l.lesson_id],
      creator_name: creatorMap[l.creator_uid]?.name || null,
      creator_avatar: creatorMap[l.creator_uid]?.avatar_url || null,
    }));

    res.status(200).json({ message: "Lấy danh sách bài học thành công", data });
  } catch (err) {
    console.error("getAllLessons error:", err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = getAllLessons;
