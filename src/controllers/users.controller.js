const { sql, poolConnect } = require("../config/db.config");

exports.getAllUsers = async (req, res) => {
  try {
    await poolConnect;
    const request = new sql.Request();
    const result = await request.query("SELECT * FROM users");
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createUser = async (req, res) => {
  const { firebase_uid, email, display_name } = req.body;
  try {
    await poolConnect;
    const request = new sql.Request();
    request.input("uid", sql.NVarChar, firebase_uid);
    request.input("email", sql.NVarChar, email);
    request.input("name", sql.NVarChar, display_name);
    await request.query(`
      INSERT INTO users (firebase_uid, email, display_name)
      VALUES (@uid, @email, @name)
    `);
    res.status(201).json({ message: "Tạo user thành công" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
