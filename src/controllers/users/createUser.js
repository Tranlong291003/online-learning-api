const { pool } = require("../../config/db.config");
const admin = require("../../config/firebase.config");

const createUser = async (req, res) => {
  const { email, password, name, avatar_url, bio, phone } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: "Thiếu thông tin người dùng" });
  }

  try {
    // Kiểm tra email đã tồn tại trong Firebase
    const existingUser = await admin
      .auth()
      .getUserByEmail(email)
      .catch((error) => {
        if (error.code !== "auth/user-not-found") {
          throw error;
        }
        return null;
      });

    if (existingUser) {
      return res.status(400).json({ error: "Email này đã được đăng ký" });
    }

    // Tạo user trong Firebase
    const userRecord = await admin.auth().createUser({
      email: email,
      password: password,
      displayName: name,
    });

    // Lưu vào PostgreSQL
    await pool.query(
      `INSERT INTO users (uid, email, name, avatar_url, bio, phone, role)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        userRecord.uid,
        email,
        name,
        avatar_url || "",
        bio || "",
        phone || "",
        "user",
      ]
    );

    res.status(201).json({
      message: "Người dùng đã được tạo thành công",
      user_id: userRecord.uid,
    });
  } catch (err) {
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
