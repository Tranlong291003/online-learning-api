const admin = require("../../config/firebase.config");
const { pool } = require("../../config/db.config");
const jwt = require("jsonwebtoken");

const loginUser = async (req, res) => {
  const { idToken, fcmToken } = req.body;

  if (!idToken) {
    return res
      .status(400)
      .json({ success: false, error: "Thiếu ID Token" });
  }

  try {
    // Xác thực ID Token từ Firebase
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const userRecord = await admin.auth().getUser(decodedToken.uid);
    const userId = decodedToken.uid;

    // Truy vấn PostgreSQL
    const result = await pool.query(
      "SELECT role, is_active, fcm_token FROM users WHERE uid = $1",
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy người dùng trong cơ sở dữ liệu",
      });
    }

    const userData = result.rows[0];

    if (userData.is_active !== true) {
      return res
        .status(400)
        .json({ success: false, error: "Tài khoản của bạn đã bị khoá" });
    }

    // Cập nhật FCM token nếu có
    if (fcmToken) {
      await pool.query(
        "UPDATE users SET fcm_token = $1 WHERE uid = $2",
        [fcmToken, userId]
      );
    }

    // Lấy role
    const role =
      userRecord.customClaims && userRecord.customClaims.role
        ? userRecord.customClaims.role
        : userData.role || "user";

    // Tạo JWT token
    const token = jwt.sign(
      {
        uid: userRecord.uid,
        email: userRecord.email,
        role: role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    const responseData = {
      success: true,
      message: "Đăng nhập thành công",
      user_id: userRecord.uid,
      email: userRecord.email,
      role: role,
      fcm_token: fcmToken,
      token: token,
    };

    res.status(200).json(responseData);
  } catch (err) {
    console.error("Lỗi khi đăng nhập:", err);
    if (
      err.code === "auth/id-token-expired" ||
      err.code === "auth/argument-error" ||
      err.codePrefix === "auth"
    ) {
      return res.status(401).json({
        success: false,
        error: "ID Token không hợp lệ hoặc đã hết hạn, vui lòng đăng nhập lại",
      });
    }
    res
      .status(500)
      .json({ success: false, error: "Lỗi khi đăng nhập: " + err.message });
  }
};

module.exports = loginUser;
