const { sql, poolPromise } = require("../../config/db.config");
const admin = require("../../config/firebase.config"); // Firebase Admin SDK

const deleteUser = (req, res) => {
  const uid = req.params.id; // chính là Firebase UID và cũng là PK trong bảng users

  poolPromise
    .then((pool) =>
      // 1) Xóa user trên Firebase
      admin
        .auth()
        .deleteUser(uid)
        .then(() => pool)
    )
    .then((pool) =>
      // 2) Xóa record trong SQL
      pool
        .request()
        .input("uid", sql.NVarChar, uid)
        .query("DELETE FROM users WHERE uid = @uid")
    )
    .then((result) => {
      if (result.rowsAffected[0] === 0) {
        // Nếu không có hàng nào bị xóa
        return res
          .status(404)
          .json({ error: "Không tìm thấy người dùng trong database" });
      }
      res.json({ message: "Người dùng đã được xóa thành công" });
    })
    .catch((err) => {
      console.error("Error in deleteUser:", err);
      // Nếu Firebase báo user không tồn tại
      if (err.code === "auth/user-not-found") {
        return res
          .status(404)
          .json({ error: "Không tìm thấy người dùng trên Firebase" });
      }
      res.status(500).json({ error: "Lỗi khi xóa người dùng: " + err.message });
    });
};

module.exports = deleteUser;
