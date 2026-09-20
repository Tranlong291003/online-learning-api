/** Kiểm tra Firebase Admin có kết nối được không (chỉ thao tác ĐỌC, an toàn). */
require("dotenv").config();
const admin = require("../src/config/firebase.config");

(async () => {
  console.log("app initialized:", admin.apps.length > 0);
  try {
    await admin.auth().getUserByEmail("definitely-not-exist@example.invalid");
    console.log("UNEXPECTED: found that email");
  } catch (e) {
    console.log("getUserByEmail -> code:", e.code);
    if (e.code === "auth/user-not-found") console.log("✅ Firebase REACHABLE và credentials hợp lệ");
    else console.log("❌ Firebase lỗi khác:", e.message.split("\n")[0]);
  }
})();
