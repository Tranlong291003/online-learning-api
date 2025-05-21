const { sql, poolPromise } = require("../../config/db.config");
const { sendNotification } = require("../../services/notificationService");

const changeCourseStatus = async (req, res) => {
  const { course_id } = req.params;
  const { status, rejectionReason, uid } = req.body;

  if (!status || !uid) {
    return res.status(400).json({ error: "Thiếu trạng thái hoặc UID" });
  }

  try {
    const pool = await poolPromise;
    const request = new sql.Request(pool);

    // Kiểm tra vai trò người dùng
    request.input("uid", sql.NVarChar, uid);
    const roleResult = await request.query(`
      SELECT role FROM users WHERE uid = @uid
    `);

    const userRole = roleResult.recordset[0]?.role;

    // Lấy thông tin khóa học và mentor
    request.input("course_id", sql.Int, course_id);
    const courseInfo = await request.query(`
      SELECT c.title, c.instructor_uid, c.status, u.fcm_token, u.name as instructor_name
      FROM courses c
      JOIN users u ON c.instructor_uid = u.uid
      WHERE c.course_id = @course_id
    `);

    if (courseInfo.recordset.length === 0) {
      return res.status(404).json({
        error: "Không tìm thấy khóa học",
      });
    }

    const {
      title,
      instructor_uid,
      fcm_token,
      instructor_name,
      status: currentStatus,
    } = courseInfo.recordset[0];

    // Kiểm tra quyền cập nhật
    // Admin có quyền thay đổi tất cả trạng thái
    // Mentor chỉ có quyền thay đổi trạng thái từ rejected -> pending
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

    // Kiểm tra rejectionReason khi từ chối (chỉ admin có thể từ chối)
    if (userRole === "admin" && status === "rejected" && !rejectionReason) {
      return res.status(400).json({
        error: "Vui lòng cung cấp lý do từ chối khóa học",
      });
    }

    // Thực hiện cập nhật
    const updateRequest = new sql.Request(pool);
    updateRequest.input("course_id", sql.Int, course_id);
    updateRequest.input("status", sql.NVarChar, status);
    updateRequest.input(
      "rejection_reason",
      sql.NVarChar,
      userRole === "admin" && status === "rejected" ? rejectionReason : null
    );
    updateRequest.input(
      "approved_at",
      sql.DateTime,
      userRole === "admin" && status === "approved" ? new Date() : null
    );

    const result = await updateRequest.query(`
      UPDATE courses
      SET
        status = @status,
        rejection_reason = @rejection_reason,
        approved_at = @approved_at,
        updated_at = GETDATE()
      WHERE course_id = @course_id
    `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({
        error: "Không tìm thấy khóa học để cập nhật trạng thái",
      });
    }

    // Gửi thông báo nếu khóa học bị từ chối hoặc được duyệt (chỉ khi admin thay đổi trạng thái)
    let fcmStatus = false;
    if (
      userRole === "admin" &&
      (status === "rejected" || status === "approved") &&
      fcm_token
    ) {
      try {
        const notificationRequest = new sql.Request(pool);
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
        notificationRequest.input("uid", sql.NVarChar, instructor_uid);
        notificationRequest.input("title", sql.NVarChar, notificationTitle);
        notificationRequest.input("content", sql.NVarChar, notificationContent);
        notificationRequest.input("icon", sql.NVarChar, icon);
        notificationRequest.input("color", sql.NVarChar, color);
        notificationRequest.input("is_read", sql.Bit, 0);

        const notiResult = await notificationRequest.query(`
          INSERT INTO notifications (
            uid, title, content, icon, color, is_read, created_at
          ) VALUES (
            @uid, @title, @content, @icon, @color, @is_read, GETDATE()
          );
          SELECT SCOPE_IDENTITY() as noti_id;
        `);

        const noti_id = notiResult.recordset[0].noti_id;

        // Gửi thông báo FCM
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

    // Truy vấn lại khóa học
    const updatedCourse = await updateRequest.query(`
      SELECT * FROM courses WHERE course_id = @course_id
    `);

    res.status(200).json({
      message: "Cập nhật trạng thái khóa học thành công",
      data: {
        ...updatedCourse.recordset[0],
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
