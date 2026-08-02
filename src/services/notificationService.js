const admin = require("firebase-admin");

const sendNotification = async (
  fcmToken,
  noti_id, // ID thông báo
  uid, // ID người dùng
  title, // Tiêu đề thông báo
  content, // Nội dung thông báo
  icon, // Biểu tượng thông báo
  color // Màu sắc thông báo
) => {
  const message = {
    token: fcmToken,
    notification: {
      title: title,
      body: content,
    },
    data: {
      noti_id: noti_id.toString(),
      uid: uid,
      title: title,
      content: content,
      icon: icon,
      color: color,
    },
  };

  try {
    const response = await admin.messaging().send(message);
    console.log("Thông báo đã được gửi thành công:", response);
    return response;
  } catch (error) {
    console.log("Lỗi khi gửi thông báo:", error);
    throw new Error("Không thể gửi thông báo");
  }
};

module.exports = { sendNotification };
