const sql = require("mssql");
require("dotenv").config();

const config = {
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || "", // nếu không có password thì để rỗng
  options: {
    encrypt: true, // thay đổi nếu bạn sử dụng SSL
    enableArithAbort: true,
  },
};

// Tạo kết nối
const pool = new sql.ConnectionPool(config);

// Sử dụng pool.connect() trả về promise
const poolConnect = pool.connect();

module.exports = { sql, pool, poolConnect };
