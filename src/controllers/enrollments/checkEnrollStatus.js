// controllers/enrollments/checkEnrollStatus.js
// Kiem tra user da dang ky khoa hoc hay chua.
const { supabaseAdmin } = require("../../services/supabase.service");

const checkEnrollStatus = async (req, res) => {
  try {
    const { course_id } = req.params;
    const user_uid = req.supabaseUser?.authUser?.id;

    if (!user_uid) return res.status(401).json({ error: "Chưa đăng nhập" });
    if (!course_id || isNaN(Number(course_id)))
      return res.status(400).json({ error: "course_id không hợp lệ" });

    const { data, error } = await supabaseAdmin
      .from("enrollments")
      .select("enrollment_id, enrolled_at")
      .eq("user_uid", user_uid)
      .eq("course_id", Number(course_id))
      .maybeSingle();
    if (error) throw error;

    res.status(200).json({
      message: "Kiểm tra trạng thái đăng ký",
      data: {
        course_id: Number(course_id),
        enrolled: !!data,
        enrollment: data || null,
      },
    });
  } catch (err) {
    console.error("checkEnrollStatus error:", err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = checkEnrollStatus;
