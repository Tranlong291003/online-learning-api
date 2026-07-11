// controllers/courses/changeCourseStatus.js
// Admin duyet / tu choi khoa hoc, gui notification + FCM.
const { updateRows, selectRows, insertRows, supabaseAdmin } = require("../../services/supabase.service");

const changeCourseStatus = async (req, res) => {
  try {
    const { course_id } = req.params;
    const { status, rejection_reason } = req.body;

    if (!["pending", "approved", "rejected"].includes(status))
      return res.status(400).json({ error: "Trạng thái không hợp lệ" });

    const { data: course, error: findErr } = await selectRows(
      supabaseAdmin, "courses", "*",
      { eq: { course_id: Number(course_id) }, single: true }
    );
    if (findErr) throw findErr;
    if (!course) return res.status(404).json({ error: "Không tìm thấy khóa học" });

    const patch = { status, updated_at: new Date().toISOString() };
    if (status === "rejected") {
      if (!rejection_reason || !rejection_reason.trim())
        return res.status(400).json({ error: "Vui lòng nhập lý do từ chối" });
      patch.rejection_reason = rejection_reason.trim();
    } else {
      patch.rejection_reason = null;
    }
    if (status === "approved") patch.approved_at = new Date().toISOString();

    const { data: updated, error: updErr } = await updateRows(
      supabaseAdmin, "courses", patch, { course_id: Number(course_id) }
    );
    if (updErr) throw updErr;

    const contents = {
      pending: `Khóa học "${course.title}" đã được chuyển về chờ duyệt.`,
      approved: `Chúc mừng! Khóa học "${course.title}" của bạn đã được duyệt.`,
      rejected: `Khóa học "${course.title}" của bạn bị từ chối: ${rejection_reason || ""}`.trim(),
    };
    const titles = {
      pending: "Khóa học chờ duyệt",
      approved: "Khóa học được duyệt",
      rejected: "Khóa học bị từ chối",
    };
    const colors = { pending: "#ff9800", approved: "#4caf50", rejected: "#f44336" };

    const { error: notifErr } = await insertRows(supabaseAdmin, "notifications", {
      uid: course.instructor_uid,
      title: titles[status],
      content: contents[status],
      icon: "book",
      color: colors[status],
    });
    if (notifErr) console.warn("Tao notification that bai:", notifErr.message);

    // FCM: doc fcm_token tu users.fcm_token (schema khong co bang fcm_tokens)
    try {
      const { getMessaging } = require("../../services/firebase.service");
      const messaging = getMessaging();
      if (messaging) {
        const { data: userRow } = await supabaseAdmin
          .from("users")
          .select("fcm_token")
          .eq("uid", course.instructor_uid)
          .maybeSingle();
        if (userRow && userRow.fcm_token) {
          await messaging.sendEachForMulticast({
            tokens: [userRow.fcm_token],
            notification: { title: titles[status], body: contents[status] },
            data: { type: "course_status", course_id: String(course.course_id) },
          });
        }
      }
    } catch (e) { console.warn("FCM push loi:", e.message); }

    res.status(200).json({
      message: "Cập nhật trạng thái khóa học thành công",
      data: updated && updated[0] ? updated[0] : { course_id: Number(course_id), ...patch },
    });
  } catch (err) {
    console.error("changeCourseStatus error:", err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

module.exports = changeCourseStatus;
