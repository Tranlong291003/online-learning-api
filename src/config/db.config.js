// config/db.js
require("dotenv").config();
const sql = require("mssql");

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER, // Địa chỉ IP công khai của máy tính hoặc tên máy chủ trên cloud
  database: process.env.DB_NAME,
  options: {
    encrypt: true, // Nếu bạn dùng Azure hoặc cần mã hóa kết nối
    trustServerCertificate: true, // Để tránh lỗi chứng chỉ SSL
  },
};

const connectDB = async () => {
  try {
    await sql.connect(dbConfig);
    console.log("Connected to SQL Server");
  } catch (err) {
    console.error("Error connecting to database:", err);
  }
};

module.exports = connectDB;
