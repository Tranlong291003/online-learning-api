// controllers/quizzes/createQuiz.js
// Tao quiz moi (trac_nghiem hoac tu_luan).
const { insertRows, selectRows, supabaseAdmin } = require("../../services/supabase.service");

const createQuiz = async (req, res) => {
  try {
    const { course_id, title, description, type, time_limit, attempt_limit } = req.body;
    const creator_uid = req.supabaseUser?.authUser?.id;

    if (!creator_uid) return res.status(401).json({ error: "Chưa đăng nhập" });
    if (!course_id || isNaN(Number(course_id)))
      return res.status(400).json({ error: "course_id không hợp lệ" });
    if (!title || !title.trim())
      return res.status(400).json({ error: "Vui lòng nhập tiêu đề" });

    const quizType = type || "trac_nghiem";
    if (!["trac_nghiem", "tu_luan"].includes(quizType))
      return res.status(400).json({ error: "type phải là 'trac_nghiem' hoặc 'tu_luan'" });

    // Kiem tra course ton tai
    const { data: course } = await supabaseAdmin
      .from("courses")
      .select("course_id, instructor_uid")
      .eq("course_id", Number(course_id))
      .maybeSingle();
    if (!course) return res.status(404).json({ error: "Không tìm thấy khóa học" });

    const role = req.supabaseUser?.profile?.role;
    if (role !== "admin" && course.instructor_uid !== creator_uid) {
      return res.status(403).json({ error: "Bạn không phải giảng viên của khóa học này" });
    }

    const { data: inserted, error } = await insertRows(
      supabaseAdmin, "quizzes", {
        course_id: Number(course_id),
        title: title.trim(),
        description: description || null,
        type: quizType,
        time_limit: time_limit ? Number(time_limit) : null,
        attempt_limit: attempt_limit ? Number(attempt_limit) : null,
        creator_uid,
      }
    );
    if (error) throw error;

    res.status(201).json({
      message: "Tạo bài kiểm tra thành công",
      data: inserted && inserted[0] ? inserted[0] : null,
    });
  } catch (err) {
    console.error("createQuiz error:", err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = createQuiz;
