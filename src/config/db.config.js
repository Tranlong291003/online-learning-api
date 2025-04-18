const sql = require("mssql");
require("dotenv").config();

const config = {
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || "", // Nếu không có password thì để rỗng
  options: {
    encrypt: false, // Thay đổi nếu bạn sử dụng SSL
    enableArithAbort: true,
  },
};

// Tạo và trả về kết nối Promise
const poolPromise = new sql.ConnectionPool(config).connect();

module.exports = { sql, poolPromise };
