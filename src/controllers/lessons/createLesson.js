// controllers/lessons/createLesson.js
// Mentor tao bai hoc moi trong khoa hoc.
const { insertRows, selectRows, supabaseAdmin } = require("../../services/supabase.service");

const createLesson = async (req, res) => {
  try {
    const { course_id, title, video_url, video_id, video_duration, pdf_url, slide_url, content, order } = req.body;
    const creator_uid = req.supabaseUser?.authUser?.id;

    if (!creator_uid) return res.status(401).json({ error: "Chưa đăng nhập" });
    if (!course_id || isNaN(Number(course_id)))
      return res.status(400).json({ error: "course_id không hợp lệ" });
    if (!title || !title.trim())
      return res.status(400).json({ error: "Vui lòng nhập tiêu đề bài học" });

    // Kiem tra course ton tai va mentor so huu (hoac admin)
    const { data: course, error: courseErr } = await selectRows(
      supabaseAdmin, "courses", "course_id,instructor_uid",
      { eq: { course_id: Number(course_id) }, single: true }
    );
    if (courseErr) throw courseErr;
    if (!course) return res.status(404).json({ error: "Không tìm thấy khóa học" });

    const role = req.supabaseUser?.profile?.role;
    if (role !== "admin" && course.instructor_uid !== creator_uid) {
      return res.status(403).json({ error: "Bạn không phải giảng viên của khóa học này" });
    }

    // Tu sinh "order" neu khong truyen
    let finalOrder = order;
    if (finalOrder === undefined || finalOrder === null) {
      const { data: lastRow } = await supabaseAdmin
        .from("lessons")
        .select("order")
        .eq("course_id", Number(course_id))
        .order("order", { ascending: false })
        .limit(1);
      finalOrder = lastRow && lastRow.length && lastRow[0].order != null
        ? Number(lastRow[0].order) + 1
        : 1;
    }

    const { data: inserted, error: insErr } = await insertRows(
      supabaseAdmin, "lessons", {
        course_id: Number(course_id),
        title: title.trim(),
        video_url: video_url || null,
        video_id: video_id || null,
        video_duration: video_duration || null,
        pdf_url: pdf_url || null,
        slide_url: slide_url || null,
        content: content || null,
        order: Number(finalOrder),
        creator_uid,
      }
    );
    if (insErr) throw insErr;

    res.status(201).json({
      message: "Tạo bài học thành công",
      data: inserted && inserted[0] ? inserted[0] : null,
    });
  } catch (err) {
    console.error("createLesson error:", err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = createLesson;
