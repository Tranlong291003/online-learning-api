const { pool } = require("../../config/db.config");
const { sendNotification } = require("../../services/notificationService");
const { resolveActorUid } = require("../../middleware/actor");

const changeCourseStatus = async (req, res) => {
  const { course_id } = req.params;
  const { status, rejectionReason } = req.body;

  if (!status) {
    return res.status(400).json({ error: "Thiếu trạng thái" });
  }

  // Lấy uid từ token; chỉ admin mới được thao tác thay người khác
  const uid = resolveActorUid(req, res, req.body.uid);
  if (!uid) return;

  try {
    // Kiểm tra vai trò người dùng
    const roleResult = await pool.query(
      "SELECT role FROM users WHERE uid = $1",
      [uid]
    );
    const userRole = roleResult.rows[0]?.role;

    // Lấy thông tin khóa học và mentor
    const courseInfo = await pool.query(
      `SELECT c.title, c.instructor_uid, c.status, u.fcm_token, u.name as instructor_name
       FROM courses c
       JOIN users u ON c.instructor_uid = u.uid
       WHERE c.course_id = $1`,
      [course_id]
    );

    if (courseInfo.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy khóa học" });
    }

    const {
      title,
      instructor_uid,
      fcm_token,
      instructor_name,
      status: currentStatus,
    } = courseInfo.rows[0];

    // Kiểm tra quyền cập nhật
    const isMentorOfCourse = instructor_uid === uid;
    const isStatusUpdateAllowed =
      userRole === "admin" ||
      (userRole === "mentor" &&
        isMentorOfCourse &&
        status === "pending" &&
        currentStatus === "rejected");

    if (!isStatusUpdateAllowed) {
      if (userRole === "mentor" && !isMentorOfCourse) {
        return res.status(403).json({
          error: "Bạn không có quyền cập nhật khóa học của người khác",
        });
      } else if (userRole === "mentor" && isMentorOfCourse) {
        return res.status(403).json({
          error:
            "Mentor chỉ có thể cập nhật trạng thái từ 'rejected' thành 'pending'",
        });
      } else {
        return res
          .status(403)
          .json({ error: "Bạn không có quyền cập nhật trạng thái khóa học" });
      }
    }

    // Kiểm tra status hợp lệ
    if (
      userRole === "admin" &&
      status !== "approved" &&
      status !== "rejected"
    ) {
      return res.status(400).json({
        error:
          "Trạng thái không hợp lệ. Admin chỉ chấp nhận 'approved' hoặc 'rejected'",
      });
    }

    if (userRole === "mentor" && status !== "pending") {
      return res.status(400).json({
        error:
          "Trạng thái không hợp lệ. Mentor chỉ có thể đổi trạng thái thành 'pending'",
      });
    }

    if (userRole === "admin" && status === "rejected" && !rejectionReason) {
      return res.status(400).json({
        error: "Vui lòng cung cấp lý do từ chối khóa học",
      });
    }

    // Thực hiện cập nhật
    const rejection_reason =
      userRole === "admin" && status === "rejected" ? rejectionReason : null;
    const approved_at =
      userRole === "admin" && status === "approved" ? new Date() : null;

    const updateResult = await pool.query(
      `UPDATE courses
       SET status = $1, rejection_reason = $2, approved_at = $3, updated_at = NOW()
       WHERE course_id = $4
       RETURNING *`,
      [status, rejection_reason, approved_at, course_id]
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({
        error: "Không tìm thấy khóa học để cập nhật trạng thái",
      });
    }

    // Gửi thông báo
    let fcmStatus = false;
    if (
      userRole === "admin" &&
      (status === "rejected" || status === "approved") &&
      fcm_token
    ) {
      try {
        let notificationContent = "";
        let notificationTitle = "";
        let icon = "";
        let color = "";

        if (status === "rejected") {
          notificationTitle = "Khóa học bị từ chối";
          notificationContent = `Khóa học \"${title}\" của bạn bị từ chối: ${rejectionReason}`;
          icon = "warning";
          color = "#FF0000";
        } else if (status === "approved") {
          notificationTitle = "Khóa học đã được duyệt";
          notificationContent = `Khóa học \"${title}\" của bạn đã được duyệt.`;
          icon = "success";
          color = "#00C853";
        }

        const notiResult = await pool.query(
          `INSERT INTO notifications (uid, title, content, icon, color, is_read, created_at)
           VALUES ($1, $2, $3, $4, $5, false, NOW())
           RETURNING noti_id`,
          [instructor_uid, notificationTitle, notificationContent, icon, color]
        );

        const noti_id = notiResult.rows[0].noti_id;

        await sendNotification(
          fcm_token,
          noti_id,
          instructor_uid,
          notificationTitle,
          notificationContent,
          icon,
          color
        );
        fcmStatus = true;
      } catch (error) {
        console.error("Lỗi gửi thông báo:", error);
        fcmStatus = false;
      }
    }

    res.status(200).json({
      message: "Cập nhật trạng thái khóa học thành công",
      data: {
        ...updateResult.rows[0],
        fcm_sent: fcmStatus,
      },
    });
  } catch (err) {
    console.error("Lỗi cập nhật trạng thái khóa học:", err);
    res.status(500).json({
      error: "Lỗi cập nhật trạng thái khóa học: " + err.message,
    });
  }
};

module.exports = changeCourseStatus;
