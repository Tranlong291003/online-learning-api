const admin = require("../../config/firebase.config"); // Firebase Admin SDK
const { poolPromise, sql } = require("../../config/db.config"); // Thêm sql vào import

const loginUser = async (req, res) => {
  const { idToken } = req.body; // Nhận ID Token từ frontend (Firebase Client SDK)

  // Kiểm tra xem ID Token có được cung cấp không
  if (!idToken) {
    return res.status(200).json({ success: false, error: "Thiếu ID Token" });
  }

  try {
    // Xác thực ID Token từ Firebase Admin SDK
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const userRecord = await admin.auth().getUser(decodedToken.uid); // Lấy thông tin người dùng từ UID

    // Lấy UID người dùng để truy vấn cơ sở dữ liệu
    const userId = decodedToken.uid;

    // Kết nối đến cơ sở dữ liệu thông qua poolPromise
    const pool = await poolPromise;

    // Truy vấn cơ sở dữ liệu để lấy thông tin role và is_active từ bảng users
    const result = await pool.request().input("uid", sql.NVarChar, userId) // Giả sử 'uid' là kiểu NVarChar trong cơ sở dữ liệu
      .query(`
        SELECT role, is_active
        FROM users
        WHERE uid = @uid
      `);

    if (result.recordset.length === 0) {
      return res.status(200).json({
        success: false,
        error: "Không tìm thấy người dùng trong cơ sở dữ liệu",
      });
    }

    const userData = result.recordset[0];

    // In ra thông tin role và is_active
    console.log(`Thông tin người dùng từ cơ sở dữ liệu:`);
    console.log(`Role: ${userData.role}`);
    console.log(`Is Active: ${userData.is_active}`);

    // Kiểm tra trường is_active từ dữ liệu người dùng
    if (userData.is_active !== true) {
      return res
        .status(200)
        .json({ success: false, error: "Tài khoản của bạn đã bị khoá" });
    }

    // Lấy thông tin role từ Firebase (giả sử thông tin role cũng được lưu trong custom claims của Firebase)
    const role =
      userRecord.customClaims && userRecord.customClaims.role
        ? userRecord.customClaims.role
        : userData.role || "user"; // Mặc định là 'user' nếu không có giá trị role trong Firebase

    // Tạo một Custom Token sau khi xác thực
    const customToken = await admin.auth().createCustomToken(userRecord.uid);

    // Hiển thị thông báo đăng nhập thành công trong server console
    console.log(
      `Đăng nhập thành công cho người dùng: ${userRecord.email} (UID: ${userRecord.uid})`
    );

    // Dữ liệu trả về cho client
    const responseData = {
      success: true,
      message: "Đăng nhập thành công",
      user_id: userRecord.uid,
      email: userRecord.email,
      custom_token: customToken, // Custom Token trả về cho client
      role: role, // Gửi thông tin role về frontend
    };

    // In dữ liệu trả về ra console
    console.log("Dữ liệu trả về từ API:", responseData);

    // Trả về dữ liệu cho client
    res.status(200).json(responseData);
  } catch (err) {
    // Ghi lại lỗi chi tiết vào console
    console.error("Lỗi khi đăng nhập:", err); // In lỗi ra console
    res
      .status(200)
      .json({ success: false, error: "Lỗi khi đăng nhập: " + err.message });
  }
};

module.exports = loginUser;
