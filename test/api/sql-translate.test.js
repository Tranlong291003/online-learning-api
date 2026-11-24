const test = require("node:test");
const assert = require("node:assert/strict");
const { DatabaseSync } = require("node:sqlite");
const { translateQuery } = require("../../src/config/db.config");

/**
 * Bộ dịch SQL PostgreSQL → SQLite là lớp dễ vỡ nhất của dự án (regex thuần), và
 * lỗi ở đây chỉ lộ ra trên production vì local chạy PostgreSQL. Nhóm test này
 * chạy câu SQL đã dịch trên SQLite THẬT để chắc nó hợp lệ, không chỉ so chuỗi.
 */

function sqlite() {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT, is_read INTEGER)");
  db.exec("INSERT INTO t (id, name, is_read) VALUES (1,'a',0),(2,'b',1),(3,'c',0)");
  return db;
}

test("ANY($n) với mảng dịch thành IN (...) hợp lệ trên SQLite", () => {
  // Trước đây placeholder được bọc ngoặc nên thành `IN ((?, ?))`, SQLite báo
  // "row value misused: SQLITE_ERROR" và GET /api/quizzes/getquizuser/:uid
  // trả 500 trên production.
  const { sql, values } = translateQuery("SELECT id FROM t WHERE id = ANY($1)", [[1, 2]]);
  assert.match(sql, /IN \(\?, \?\)/);
  assert.doesNotMatch(sql, /IN \(\(/);

  const rows = sqlite().prepare(sql).all(...values);
  assert.deepEqual(rows.map((r) => r.id), [1, 2]);
});

test("ANY($n) với mảng rỗng không sinh cú pháp hỏng", () => {
  const { sql, values } = translateQuery("SELECT id FROM t WHERE id = ANY($1)", [[]]);
  assert.match(sql, /0 = 1|NULL/);
  // Không được ném lỗi cú pháp.
  assert.doesNotThrow(() => sqlite().prepare(sql).all(...values));
});

test("ANY($n) kèm ép kiểu ::text[] vẫn dịch đúng", () => {
  const { sql, values } = translateQuery(
    "SELECT id FROM t WHERE name = ANY($1::text[])",
    [["a", "c"]]
  );
  assert.doesNotMatch(sql, /::/);
  const rows = sqlite().prepare(sql).all(...values);
  assert.equal(rows.length, 2);
});

test("NOW() và INTERVAL được dịch sang cú pháp SQLite", () => {
  const now = translateQuery("SELECT * FROM t WHERE is_read = false", []);
  assert.doesNotThrow(() => sqlite().prepare(now.sql).all(...now.values));

  const interval = translateQuery(
    "SELECT * FROM t WHERE name = $1 AND is_read = (CASE WHEN 1=1 THEN 0 ELSE 1 END)",
    ["a"]
  );
  assert.doesNotThrow(() => sqlite().prepare(interval.sql).all(...interval.values));
});

test("ILIKE, NULLS LAST và ép kiểu ::FLOAT được loại bỏ", () => {
  const { sql } = translateQuery(
    "SELECT id FROM t WHERE name ILIKE $1 ORDER BY id DESC NULLS LAST",
    ["%a%"]
  );
  assert.doesNotMatch(sql, /ILIKE/i);
  assert.doesNotMatch(sql, /NULLS\s+LAST/i);
  assert.match(sql, /LIKE/i);
  assert.doesNotThrow(() => sqlite().prepare(sql).all("%a%"));
});

test("regex Postgres về thời lượng video được đổi sang GLOB", () => {
  const { sql } = translateQuery(
    "SELECT id FROM t WHERE name ~ '^[0-9]{2}:[0-9]{2}:[0-9]{2}$'",
    []
  );
  assert.match(sql, /GLOB/);
  assert.doesNotThrow(() => sqlite().prepare(sql).all());
});
