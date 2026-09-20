/**
 * Chạy thử MỌI câu INSERT/UPDATE của app vào DB THẬT trong 1 transaction,
 * rồi ROLLBACK. Không thay đổi dữ liệu. Mục đích: lộ tên cột/kiểu dữ liệu sai.
 */
require("dotenv").config();
const { Pool } = require("pg");

const UID = "abb8127b-fc22-466e-8473-51000b7f2114";
const CID = 76;      // course có thật
const LID = 254;     // lesson có thật
const QID = 31;      // quiz có thật
const CAT = 23;      // category có thật

// [nhãn, sql, params]
const stmts = [
  ["bookmarks/create", `INSERT INTO bookmarks (course_id, user_uid, created_at) VALUES ($1,$2,NOW()) RETURNING bookmark_id`, [CID, UID]],
  ["categories/create", `INSERT INTO course_categories (name, description, icon, created_at) VALUES ($1,$2,$3,NOW()) RETURNING category_id`, ["sweep", "d", null]],
  ["categories/update(icon)", `UPDATE course_categories SET name=$1, description=$2, icon=$3, updated_at=NOW() WHERE category_id=$4`, ["a","b",null,CAT]],
  ["courses/create", `INSERT INTO courses (title,description,instructor_uid,category_id,level,price,discount_price,status,rejection_reason,language,tags,thumbnail_url,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),NOW()) RETURNING course_id`, ["s","d",UID,CAT,"beginner",1,null,"pending",null,"vi","t",null]],
  ["courses/changeStatus", `UPDATE courses SET status=$1, rejection_reason=$2, approved_at=$3, updated_at=NOW() WHERE course_id=$4 RETURNING course_id`, ["approved", null, new Date(), CID]],
  ["enrollments/create", `INSERT INTO enrollments (user_uid, course_id, enrolled_at) VALUES ($1,$2,NOW()) RETURNING enrollment_id`, [UID, CID]],
  ["lessons/complete(ON CONFLICT)", `INSERT INTO lesson_progress (user_uid,course_id,lesson_id,is_completed,completed_at) VALUES ($1,$2,$3,true,NOW()) ON CONFLICT (user_uid, course_id, lesson_id) DO UPDATE SET is_completed=true, completed_at=NOW() RETURNING CASE WHEN xmax=0 THEN 'INSERT' ELSE 'UPDATE' END AS action`, [UID, CID, LID]],
  ["lessons/create", `INSERT INTO lessons (course_id,title,video_url,video_id,video_duration,pdf_url,slide_url,content,"order",creator_uid,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW()) RETURNING lesson_id`, [CID, "s", null, null, null, null, null, "c", 1, UID]],
  ["mentorRequests/create", `INSERT INTO upgrade_requests (user_uid, status, reason, image_url, created_at, updated_at) VALUES ($1,'pending',NULL,$2,NOW(),NOW()) RETURNING id`, [UID, "/x.png"]],
  ["mentorRequests/updateStatus", `UPDATE upgrade_requests SET status=$1, reason=$2, updated_at=NOW() WHERE id=$3`, ["approved", null, 1]],
  ["notifications/create", `INSERT INTO notifications (uid,title,content,icon,color,is_read,created_at) VALUES ($1,$2,$3,$4,$5,false,NOW()) RETURNING noti_id`, [UID,"t","c","i","#000"]],
  ["questions/manual", `INSERT INTO quiz_questions (quiz_id,question,options,correct_index,expected_keywords,created_at) VALUES ($1,$2,$3,$4,$5,NOW()) RETURNING question_id`, [QID,"q","[\"a\"]",0,null]],
  ["questions/fromAi", `INSERT INTO quiz_questions (quiz_id,question,options,correct_index,created_at) VALUES ($1,$2,$3,$4,NOW()) RETURNING question_id`, [QID,"q","[\"a\"]",0]],
  ["quizResults/submit", `INSERT INTO quiz_results (user_uid, quiz_id, score, submitted_at, answers, explanation, status) VALUES ($1,$2,$3,NOW(),$4,$5,$6) RETURNING result_id`, [UID, QID, 5.0, "{}", "e", "da_cham"]],
  ["quizResults/GRADE", `UPDATE quiz_results SET explanation=$1, score=$2, status='da_cham', graded_by=$3, graded_at=NOW() WHERE result_id=$4 RETURNING result_id`, ["e", 9, 1, 1]],
  ["quizzes/create", `INSERT INTO quizzes (course_id,title,type,time_limit,attempt_limit,creator_uid,created_at) VALUES ($1,$2,$3,$4,$5,$6,NOW()) RETURNING quiz_id`, [CID,"t","trac_nghiem",10,2,UID]],
  ["reviews/create", `INSERT INTO course_reviews (course_id,user_uid,rating,comment,created_at) VALUES ($1,$2,$3,$4,NOW()) RETURNING review_id`, [CID, UID, 5, "c"]],
  ["users/updateRole", `UPDATE users SET role=$1, updated_at=NOW() WHERE uid=$2 RETURNING uid`, ["user", UID]],
  ["users/updateUserStatus", `UPDATE users SET is_active=$1, updated_at=NOW() WHERE uid=$2 RETURNING uid`, [true, UID]],
  ["users/create", `INSERT INTO users (uid,email,name,avatar_url,bio,phone,role) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING uid`, ["sweep","a@b.c","n",null,null,null,"user"]],
  ["users/login(fcm)", `UPDATE users SET fcm_token=$1 WHERE uid=$2`, ["tok", UID]],
];

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const c = await pool.connect();
  const bad = [];
  await c.query("BEGIN");
  for (const [label, sql, params] of stmts) {
    await c.query("SAVEPOINT sp");
    try {
      await c.query(sql, params);
      console.log("OK   " + label);
      await c.query("ROLLBACK TO SAVEPOINT sp");
    } catch (e) {
      const msg = e.message.split("\n")[0];
      console.log("BAD  " + label.padEnd(30) + " " + msg);
      bad.push(label + " :: " + msg);
      await c.query("ROLLBACK TO SAVEPOINT sp");
    }
  }
  c.release();
  await pool.end();
  console.log("\n== " + bad.length + " câu ghi sai ==");
  bad.forEach((b) => console.log("  - " + b));
})();
