const { poolPromise, sql } = require("../../config/db.config"); // Thêm sql vào import
const admin = require("../../config/firebase.config"); // Firebase Admin SDK

const createUser = async (req, res) => {
  const { email, password, name, avatar_url, bio, phone, role } = req.body;

  // Kiểm tra các thông tin cần thiết
  if (!email || !password || !name) {
    return res.status(400).json({ error: "Thiếu thông tin người dùng" });
  }

  try {
    // Kiểm tra xem email đã tồn tại trong Firebase hay chưa
    const existingUser = await admin
      .auth()
      .getUserByEmail(email)
      .catch((error) => {
        if (error.code !== "auth/user-not-found") {
          throw error; // Nếu có lỗi khác ngoài "user-not-found", ném lỗi
        }
        return null;
      });

    if (existingUser) {
      return res.status(400).json({ error: "Email này đã được đăng ký" });
    }

    // Tạo người dùng mới trong Firebase Authentication
    const userRecord = await admin.auth().createUser({
      email: email,
      password: password, // Firebase sẽ mã hóa mật khẩu tự động
      displayName: name, // Thay displayName bằng name
    });

    // Lưu thông tin người dùng vào cơ sở dữ liệu SQL Server
    const pool = await poolPromise; // Sử dụng poolPromise để kết nối đến cơ sở dữ liệu
    const request = new sql.Request(pool);

    // Lưu thông tin người dùng vào SQL Server
    request.input("uid", sql.NVarChar, userRecord.uid);
    request.input("email", sql.NVarChar, email);
    request.input("name", sql.NVarChar, name); // Thay display_name bằng name
    request.input("avatar_url", sql.NVarChar, avatar_url || "");
    request.input("bio", sql.NVarChar, bio || "");
    request.input("phone", sql.NVarChar, phone || ""); // Thay phone_number bằng phone
    request.input("role", sql.NVarChar, role || "user");

    // Câu truy vấn SQL để thêm người dùng vào cơ sở dữ liệu
    await request.query(
      "INSERT INTO users (uid, email, name, avatar_url, bio, phone, role) " + // Thay phone_number bằng phone
        "VALUES (@uid, @email, @name, @avatar_url, @bio, @phone, @role)"
    );

    // Trả về thông báo thành công
    res.status(200).json({
      message: "Người dùng đã được tạo thành công",
      user_id: userRecord.uid, // Trả về Firebase UID
    });
  } catch (err) {
    // Xử lý lỗi và trả về thông báo lỗi
    console.error(err);
    if (err.code === "auth/email-already-exists") {
      res.status(400).json({
        success: false,
        error: "Email này đã được sử dụng bởi một tài khoản khác.",
      });
    } else {
      res.status(500).json({
        success: false,
        error: "Lỗi khi tạo người dùng: " + err.message,
      });
    }
  }
};

module.exports = createUser;
