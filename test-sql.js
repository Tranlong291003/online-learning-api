const sql = require("mssql");
require("dotenv").config();

const config = {
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: false,
    enableArithAbort: true,
  },
};

sql
  .connect(config)
  .then(() => {
    console.log("✅ Kết nối SQL thành công!");
    sql.close();
  })
  .catch((err) => {
    console.error("❌ Kết nối thất bại:", err.message);
  });
