const { sql, poolPromise } = require("../../config/db.config");

const createNotification = async (req, res) => {
  const { uid, title, content, icon, color } = req.body;
  const createdAt = new Date();

  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("uid", sql.NVarChar, uid)
      .input("title", sql.NVarChar, title)
      .input("content", sql.NVarChar, content)
      .input("icon", sql.NVarChar, icon)
      .input("color", sql.NVarChar, color)
      .input("is_read", sql.Bit, false)
      .input("created_at", sql.DateTime, createdAt)
      .query(
        "INSERT INTO notifications (noti_id, uid, title, content, icon, color, is_read, created_at) VALUES (NEWID(), @uid, @title, @content, @icon, @color, @is_read, @created_at)"
      );

    res.status(201).json({
      noti_id: result.recordset[0].noti_id,
      uid,
      title,
      content,
      icon,
      color,
      is_read: false,
      created_at: createdAt,
    });
  } catch (error) {
    console.log("Lỗi khi tạo thông báo:", error);
    res.status(500).send({ message: "Không thể tạo thông báo" });
  }
};

module.exports = createNotification;
