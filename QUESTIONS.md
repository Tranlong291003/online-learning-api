# Những điểm cần bạn quyết định

> Tổng hợp sau khi đọc toàn bộ mã nguồn, tài liệu và kiểm chứng trên production
> (`https://lms.tranlong291003.workers.dev`) ngày 24-11-2026.
>
> **Trạng thái: đã deploy 4 lần** (bản mới nhất `2d1bb489-db5a-427d-b305-8385c65058e9`).
> Test local: **329 pass / 0 fail**. Test production: **126 pass / 0 fail**
> (`node scripts/prod-verify.mjs`).
>
> Mỗi mục dưới đây ghi rõ: hiện trạng, vì sao tôi không tự sửa, và các phương án để
> bạn chọn. Các lỗi **chắc chắn** đã được sửa trực tiếp trong mã nguồn — danh sách đầy
> đủ ở cuối file.

---

## 1. [Bảo mật] `forgot-password` không gửi được email

**Hiện trạng:** `src/controllers/auth/forgotPassword.js` tạo token đặt lại mật khẩu và
lưu hash vào `password_resets`, nhưng **không có bước gửi mail nào**. Ở production
(`NODE_ENV=production`) token bị bỏ đi hoàn toàn, nên người dùng quên mật khẩu
**không thể** lấy lại tài khoản.

Đã kiểm chứng: `POST /api/auth/forgot-password` trên production trả 200 với thông điệp
chung, không kèm `reset_token` (đúng như thiết kế), nhưng cũng không có email nào được gửi.

**Vì sao cần bạn quyết:** phải chọn nhà cung cấp email, thêm dependency và cấu hình
credential — tôi không được thêm dependency khi chưa hỏi.

**Phương án:**
- (a) Resend — đơn giản nhất cho Node/Worker, có HTTP API (không cần SMTP).
- (b) SendGrid / Amazon SES — phổ biến, có free tier.
- (c) Bỏ hẳn luồng forgot-password và để admin đặt lại mật khẩu hộ.
- (d) Giữ nguyên, chấp nhận người dùng quên mật khẩu phải liên hệ admin.

**Cần bạn cung cấp:** nhà cung cấp đã chọn + API key (hoặc xác nhận dùng biến env nào).

---

## 2. [ĐÃ SỬA] Học viên nộp bài không cần ghi danh

**Trước đây:** `POST /api/quiz-results/submit` chỉ kiểm tra `quiz_id` có tồn tại,
không kiểm tra người nộp đã ghi danh khoá học chứa quiz đó hay chưa. Hệ quả: bất kỳ ai
đã đăng nhập cũng nộp được bài của mọi khoá, và response trả kèm `correct_answer` cho
từng câu — tức là đọc ngược được đáp án của đề chưa học.

**Đã sửa:** `submitQuizResult` đọc thêm `course_id` của quiz và chặn bằng 403
`"Bạn chưa ghi danh khóa học chứa bài kiểm tra này"`. Admin vẫn bỏ qua được bước này
(để chấm/thử). Đã kiểm chứng trên production: user chưa ghi danh → 403, user đã ghi
danh → 201.

**Còn lại cần bạn quyết:** `GET /api/questions/:quiz_id` và
`GET /api/quizzes/getquizbycourse/:course_id` vẫn cho mọi user đã đăng nhập xem **đề
bài** (không kèm đáp án) của mọi khoá. Nếu bạn muốn chặn cả phần đề thì cần một quyết
định sản phẩm riêng ("học thử" hay không).

**Phương án cho phần đề bài:**
- (a) Giữ nguyên — đề bài công khai, chỉ đáp án là ẩn (hiện trạng).
- (b) Chỉ trả đề khi đã ghi danh khoá học chứa quiz.

---

## 3. [Nghiệp vụ] Mentor có thể tự duyệt khoá học của mình không?

**Hiện trạng:** `PATCH /api/courses/:id/status` cho mentor chỉ đổi `rejected → pending`
(không tự duyệt được). Đây là hành vi **đúng**. Nhưng câu hỏi mở: khi mentor sửa nội
dung một khoá **đã được duyệt** (`PUT /api/courses/update/:id`), trạng thái vẫn là
`approved` — nội dung mới không phải duyệt lại.

**Vì sao cần bạn quyết:** đây là lựa chọn thiết kế (duyệt một lần hay duyệt lại mỗi
lần sửa), ảnh hưởng trực tiếp trải nghiệm mentor.

**Phương án:**
- (a) Giữ nguyên: duyệt một lần, tin tưởng mentor.
- (b) Sửa khoá đã duyệt → tự động về `pending` để admin duyệt lại.

---

## 4. [ĐÃ SỬA] Trả 404 vs 200-rỗng cho danh sách không có dữ liệu

**Trước đây không nhất quán:**

| Endpoint | Danh sách rỗng (trước) | Bây giờ |
| --- | --- | --- |
| `GET /api/courses` | 200 + `{ message }` (thiếu `data`) | 200 + `{ data: {pending:[],approved:[],rejected:[]}, total: 0 }` |
| `GET /api/courses/mentor/:uid` | 200 + `{ message }` (thiếu `data`) | 200 + cùng cấu trúc trên |
| `GET /api/quizzes/getquizbycourse/:id` | **404** | **200 + `data: []`** |
| `GET /api/questions/:quiz_id` | **404** | **200 + `data: []`** |

**Đã sửa cả 4 chỗ.** Lý do: "danh sách rỗng" là trạng thái bình thường (khoá mới chưa
có quiz, đề vừa tạo chưa có câu hỏi), không phải lỗi. Trả 404 buộc FE phải phân biệt
"khoá không tồn tại" với "khoá chưa có dữ liệu" cho cùng một màn hình.

**⚠️ Lưu ý cho FE:** đây là **thay đổi hợp đồng API**. Chỗ nào FE đang dựa vào mã 404
để hiện "chưa có đề" thì cần đổi sang kiểm tra `data.length === 0`.

---

## 5. [Dữ liệu] File upload cũ trong `src/public/uploads/` (49 MB, 126 file)

**Hiện trạng:** từ khi chuyển sang lưu file trong CSDL (`uploaded_files`), thư mục
`src/public/uploads/` không còn được ghi. Tuy nhiên 126 file (~49 MB) vẫn **được
track trong git** và vẫn được phục vụ qua `express.static` (fallback cho URL cũ).

**Vì sao cần bạn quyết:** xoá đi thì các URL cũ trong CSDL trỏ tới file này sẽ 404;
giữ lại thì repo phình 49 MB mãi mãi.

**Phương án:**
- (a) Giữ nguyên (an toàn, không phá URL cũ).
- (b) Chạy script một lần để nạp các file này vào bảng `uploaded_files`, xác nhận
  mọi URL còn dùng được, rồi xoá khỏi git.
- (c) Xoá ngay (chấp nhận một số ảnh cũ 404).

Tôi có thể viết script cho phương án (b) nếu bạn chọn.

---

## 6. [Dữ liệu] Kiểu `noti_id` khác nhau giữa hai môi trường

**Hiện trạng:** PostgreSQL dùng `SERIAL` (số nguyên), D1 dùng UUID chuỗi. Code xử lý
được cả hai (controller validate bằng regex UUID), nhưng:

- Nếu ai đó chạy PostgreSQL local rồi migrate dữ liệu sang D1, `noti_id` dạng số sẽ
  **không** khớp regex UUID → mọi thao tác mark-read/delete trả 400.
- Test hiện tại dùng cả hai dạng (`noti_id: 1` và UUID).

**Vì sao cần bạn quyết:** chọn một kiểu thống nhất là thay đổi schema, cần migration.

**Phương án:**
- (a) Thống nhất UUID ở cả hai (sửa `database_postgres.sql` + migration).
- (b) Thống nhất số nguyên (khó, vì D1 đã có dữ liệu UUID).
- (c) Giữ nguyên, chấp nhận chỉ chạy được một môi trường tại một thời điểm.

---

## 7. [Vận hành] Chưa có lịch dọn dữ liệu hết hạn

**Hiện trạng:** đã có hàm `cleanupExpiredTokens()` trong `src/services/tokenService.js`
nhưng **không nơi nào gọi**. Bảng `refresh_tokens` và `password_resets` sẽ phình dần.

**Vì sao cần bạn quyết:** Cloudflare Workers không có cron built-in theo cách thông
thường; cần chọn cơ chế (Cron Trigger của Worker / endpoint bảo vệ bằng secret / chạy
tay).

**Phương án:**
- (a) Thêm Cron Trigger trong `wrangler.jsonc` gọi một hàm dọn dẹp.
- (b) Thêm endpoint `POST /api/admin/cleanup` bảo vệ bằng secret, gọi từ ngoài.
- (c) Chạy tay khi cần (hiện trạng).

---

## 8. [Nghiệp vụ] Điểm đạt (pass) cố định 5/10

**Hiện trạng:** `getResultsByUser` tính `passed` bằng `score >= 5.0`, viết cứng trong
SQL. Nếu mỗi quiz cần ngưỡng đạt riêng (ví dụ 7/10 cho bài cuối khoá) thì phải thêm
cột `pass_score` vào bảng `quizzes`.

**Vì sao cần bạn quyết:** thêm cột là thay đổi schema.

**Phương án:**
- (a) Giữ 5/10 cho mọi quiz.
- (b) Thêm `quizzes.pass_score` (mặc định 5).

---

## 9. [Bảo mật] Giới hạn tần suất (rate limit)

**Hiện trạng:** không có rate limit ở tầng ứng dụng. `login` có đếm số lần sai và khoá
tài khoản (đúng), nhưng không giới hạn theo IP — kẻ tấn công có thể thử mật khẩu của
nhiều tài khoản khác nhau (credential stuffing) mà không bị chặn.

**Vì sao cần bạn quyết:** trên Cloudflare nên dùng rate limiting của Cloudflare
(không cần code) hay thêm middleware + lưu trạng thái (cần KV/D1 ghi mỗi request).

**Phương án:**
- (a) Bật Rate Limiting Rules trên dashboard Cloudflare (khuyến nghị, không tốn code).
- (b) Tự viết middleware đếm theo IP trong D1.
- (c) Giữ nguyên.

---

## 10. [Tài liệu] `API_DOCUMENTATION.md` có thể đã lệch so với code

**Hiện trạng:** tài liệu 22 KB mô tả 64 endpoint, viết tay, không được sinh tự động.
Trong khi đó Swagger (`/api-docs`) sinh trực tiếp từ router nên luôn khớp.

**Vì sao cần bạn quyết:** tôi chỉ sửa được các chỗ rõ ràng sai (đã sửa phần AI/OpenAI),
nhưng rà toàn bộ 22 KB để đối chiếu từng trường request/response là việc lớn và dễ
đụng vào nội dung bạn đang dùng để bàn giao.

**Phương án:**
- (a) Giữ `API_DOCUMENTATION.md` và tôi rà soát toàn bộ (cần thời gian).
- (b) Bỏ nó, chỉ dùng Swagger làm nguồn duy nhất.
- (c) Giữ nhưng thêm ghi chú "có thể lệch, xem Swagger là chuẩn".

---

## 11. [Kiến trúc] Hai chế độ chạy song song (D1 và PostgreSQL)

**Hiện trạng:** `src/config/db.config.js` dịch câu SQL PostgreSQL sang SQLite bằng
chuỗi regex. Cách này chạy được nhưng rất giòn:

- `~ '^[0-9]{2}:[0-9]{2}:[0-9]{2}$'` (regex Postgres) → `GLOB` (SQLite) chỉ hỗ trợ
  đúng hai mẫu đã viết cứng.
- `NOW() + make_interval(mins => $n)` chỉ dịch được đúng một dạng.
- `CONCAT`, `FLOOR` tình cờ có trong SQLite nên không cần dịch — nhưng đây là may mắn,
  không phải thiết kế.

**Vì sao cần bạn quyết:** chọn một CSDL duy nhất sẽ xoá được cả tầng dịch này (khoảng
170 dòng phức tạp). Nhưng nếu bạn cần chạy local bằng PostgreSQL để dev nhanh thì phải
giữ.

**Phương án:**
- (a) Chỉ hỗ trợ D1; local dùng `wrangler dev` (đã có sẵn `npm run cf:dev`).
- (b) Chỉ hỗ trợ PostgreSQL; bỏ Cloudflare.
- (c) Giữ cả hai (hiện trạng) và chấp nhận rủi ro câu SQL mới không dịch được.

---

## 12. [Bug đã biết, chưa sửa] `checkEnrollStatus` không kiểm tra quyền sở hữu khi admin xem

Đây thực ra là hành vi đúng (`resolveActorUid` cho admin xem hộ). Nhưng cần xác nhận:
**mentor có được xem trạng thái ghi danh của học viên trong khoá mình dạy không?**
Hiện tại mentor bị chặn (403) vì chỉ admin và chính chủ được xem. Nếu mentor cần xem
để quản lý lớp thì cần mở thêm nhánh.

**Phương án:** (a) giữ nguyên; (b) cho mentor xem học viên trong khoá mình dạy.

---

## Tổng hợp lỗi đã sửa trực tiếp trong mã nguồn

| # | Lỗi | File |
| --- | --- | --- |
| 1 | `parseOptionalInt` không được import → mọi request sửa bài học có `order` đều 500 | `lessons/updateLesson.js` |
| 2 | Xoá quiz 500 trên D1 (thiếu xoá `quiz_questions` trước, và không nguyên tử) | `quizzes/deleteQuiz.js` |
| 3 | Sửa câu hỏi tự luận xoá mất `options`/`correct_index` | `questions/updateQuestion.js` |
| 4 | Điểm quiz tính trên số câu **đã gửi** thay vì tổng số câu → 1/10 câu đúng vẫn 10 điểm | `quizResults/submitQuizResult.js` |
| 5 | `worker_threads` không chạy trên Cloudflare Workers → mọi bài có câu sai đều 500 | `quizResults/getQuizResultById.js` |
| 6 | Chấm điểm nhận `score` ngoài 0–10 | `quizResults/gradeQuizResult.js` |
| 7 | `updateCourse` không validate `level`/`price` → 500 | `courses/updateCourse.js` |
| 8 | `createQuiz`/`updateQuiz` không validate `type`, `time_limit` → 500 | `quizzes/createQuiz.js`, `quizzes/updateQuiz.js` |
| 9 | `deleteUser` fail trên D1 do thiếu CASCADE; nhánh 409 không bao giờ chạy | `users/deleteUser.js` |
| 10 | `deleteCategory` nhánh 409 không chạy trên D1 | `courseCategories/deleteCategory.js` |
| 11 | Đăng ký trùng email trả 500 trên D1 thay vì 400 | `auth/register.js` |
| 12 | Refresh token luôn bị nâng lên "ghi nhớ 90 ngày" → phiên không bao giờ hết hạn | `services/tokenService.js` |
| 13 | Admin không sửa/xoá được review, bookmark của người khác | `reviews/*.js`, `bookmarks/deleteBookmark.js` |
| 14 | `getAllCourses`/`getMentorCourses` trả cấu trúc khác khi danh sách rỗng | `courses/getAllCourses.js`, `courses/getMentorCourses.js` |
| 15 | `progress_percent` thành `NaN` khi COUNT trả thiếu | `enrollments/getCourseProgressForUser.js` |
| 16 | `updateUser` trả `fcm_token` (khoá push) ra client | `users/updateUser.js` |
| 17 | `deleteCourse` có nhánh transaction 130 dòng là dead code | `courses/deleteCourse.js` |
| 18 | `createQuestionFromAi` gọi `pool.connect()` (không hỗ trợ trên D1) | `questions/createQuestionFromAi.js` |
| 19 | Thay ảnh/tài liệu không dọn file cũ → `uploaded_files` phình mãi | `updateCourse`, `updateCategory`, `updateLesson` |
| 20 | `submitQuizResult` không validate `quiz_id` → 500 với chuỗi lạ | `quizResults/submitQuizResult.js` |
| 21 | `Number.isInteger("8")` là `false` → client gửi chuỗi số hợp lệ vẫn bị 400 | `lessons/completeLesson.js` |
| 22 | `courseId`/`course_id`/`bookmarkId` không ép số → 500 với chuỗi lạ | `enrollCourse.js`, `createBookmark.js`, `deleteBookmark.js`, `createReview.js` |
| 23 | `correct_index` dạng chuỗi ("2") bị từ chối oan | `createQuestionManual.js`, `updateQuestion.js` |
| 24 | `PUT /mentor-requests/:id/status` trả 200 "đã duyệt" cho id không tồn tại | `mentorRequest.controller.js` |
| 25 | Mentor/admin gửi được yêu cầu nâng cấp; khi duyệt thì role bị ghi đè (admin tự hạ quyền) | `mentorRequest.controller.js` |
| 26 | `discount_price > price` → `discount_percent` âm, giá hiển thị sai | `createCourse.js`, `updateCourse.js`, `utils/coursePricing.js` |
| 27 | Nộp bài không cần ghi danh, response kèm `correct_answer` → đọc ngược đáp án | `quizResults/submitQuizResult.js` |
| 28 | `getQuizzesByCourse`/`getQuestionsByQuiz` trả 404 cho danh sách rỗng | `quizzes/getQuizzesByCourse.js`, `questions/getQuestionsByQuiz.js` |
| **29** | **`Error 1102: Worker exceeded resource limits` — bcrypt cost 12 tốn ~390ms CPU, đăng nhập fail 10/15 lần** | `services/passwordService.js`, `config/auth.config.js`, `auth/login.js` |
| **30** | **Phục vụ file upload trả 500: D1 trả cột BLOB là `Blob` (không có `.length`), `res.end(blob)` ném lỗi** | `services/fileStorage.js` |
| **31** | **`D1_TYPE_ERROR: Type 'undefined' not supported` — trường tuỳ chọn không gửi lên (icon/color/description) làm D1 từ chối** | `config/db.config.js`, `notification/createNotification.js` |
| **32** | **`row value misused: SQLITE_ERROR` — `ANY($n)` dịch thành `IN ((?,?))` (ngoặc kép)** | `config/db.config.js` |
| **33** | **`deleteFiles()` xoá im lặng không được gì trên D1: `ANY($1::text[])` bị xoá ép kiểu trước khi dịch `ANY` → `ANY(?[])`** | `config/db.config.js` |

> Các mục **in đậm (29–33)** là lỗi **chỉ xuất hiện trên production (D1/Workers)**, không
> thể phát hiện bằng bộ test mock chạy PostgreSQL. Chúng được tìm ra bằng cách gọi thật
> vào API production + đọc log bằng `wrangler tail`.

**Rác đã dọn:** `delete_course.sql` (rỗng), `test-sql.js` (script SQL Server cũ),
`src/controllers/course.controller.js` + `src/routes/course.routes.js` (placeholder
rỗng, không mount), `src/controllers/users/getUserById.js` (không route nào dùng),
`scripts/live-fk-dump.cjs`, `scripts/live-route-list.cjs`, `scripts/live-cleanup-e2e.cjs`,
`scripts/coverage-check.js`, `scripts/live-firebase-check.cjs`,
`scripts/live-openai-check.cjs`, `postman-login-test.collection.json` (dùng Firebase
Auth đã bỏ), 3 npm script trỏ tới file không tồn tại, thêm `.wrangler/` vào `.gitignore`.

---

## Verification (đã chạy thật)

**Test local — `npm test`:**
```
ℹ tests 329
ℹ pass 329
ℹ fail 0
```

**Test production — `node scripts/prod-verify.mjs`** (126 kiểm tra trên dữ liệu thật,
dùng tài khoản tạm rồi tự dọn):
```
================ TỔNG KẾT ================
Tổng: 126 | PASS: 126 | FAIL: 0
```

**Độ ổn định đăng nhập** (trước khi sửa bcrypt→PBKDF2 là **10/15 lần lỗi 5xx**):
```
login 20 lần: lỗi 5xx = 0
```

**Kiểm tra bổ sung:**
- `node --check` toàn bộ `src/` + `scripts/`: pass.
- `git diff --check`: pass (không lỗi whitespace).
- `getquizuser` (endpoint từng 500) → 200 với dữ liệu thật.
- `deleteFiles` chạy trên SQLite thật: 3 dòng → 1 dòng còn lại (xoá đúng).
- DB production: hash của `demo-viewer` đã tự nâng cấp sang `pbkdf2_sha256$...`.

**Các bản deploy:**
| Lần | Version ID |
| --- | --- |
| 1 | `fec57bb4-afa8-49f0-8000-0f393f6dd203` |
| 2 | `afecd2f8-65b0-47c1-a4ba-895a3fd5cd59` |
| 3 | `992efbef-372c-4a63-9bf6-9812ab82565f` |
| **4 (hiện tại)** | **`2d1bb489-db5a-427d-b305-8385c65058e9`** |

**Trạng thái git:** 60 file thay đổi, 1813 dòng thêm / 530 dòng xoá. **Chưa commit** —
theo quy ước của bạn tôi không tự commit/push.

---

## ⚠️ Tài khoản tạm còn sót trên production D1

Mỗi lần chạy `scripts/prod-verify.mjs`, script tạo một tài khoản tạm để test luồng ghi
rồi **không xoá được** — API không có endpoint tự xoá tài khoản, và xoá bằng SQL cần
dọn 9 bảng con trước (D1 không có `ON DELETE CASCADE`). Hiện còn 10 tài khoản:

| Email |
| --- |
| `e2e-1795474340708@demo.onlinelearning.vn` |
| `diag-1795474418343@verify.local` |
| `verify-1795474629723@verify.local` |
| `role-1795474630261@verify.local` |
| `verify-1795474941213@verify.local` |
| `role-1795474941687@verify.local` |
| `verify-1795475127434@verify.local` |
| `role-1795475127872@verify.local` |
| `verify-1795475283169@verify.local` |
| `role-1795475283660@verify.local` |

Đây là lệnh dọn (tôi **chưa chạy** vì đây là xoá dữ liệu trên production, cần bạn xác
nhận):

```sql
-- Xoá dữ liệu con trước, rồi mới xoá user (D1 không có ON DELETE CASCADE)
DELETE FROM notifications      WHERE uid IN (SELECT uid FROM users WHERE email LIKE '%@verify.local' OR email LIKE 'e2e-%@demo.onlinelearning.vn');
DELETE FROM refresh_tokens     WHERE uid IN (SELECT uid FROM users WHERE email LIKE '%@verify.local' OR email LIKE 'e2e-%@demo.onlinelearning.vn');
DELETE FROM password_resets    WHERE uid IN (SELECT uid FROM users WHERE email LIKE '%@verify.local' OR email LIKE 'e2e-%@demo.onlinelearning.vn');
DELETE FROM upgrade_requests   WHERE user_uid IN (SELECT uid FROM users WHERE email LIKE '%@verify.local' OR email LIKE 'e2e-%@demo.onlinelearning.vn');
DELETE FROM lesson_progress    WHERE user_uid IN (SELECT uid FROM users WHERE email LIKE '%@verify.local' OR email LIKE 'e2e-%@demo.onlinelearning.vn');
DELETE FROM bookmarks          WHERE user_uid IN (SELECT uid FROM users WHERE email LIKE '%@verify.local' OR email LIKE 'e2e-%@demo.onlinelearning.vn');
DELETE FROM course_reviews     WHERE user_uid IN (SELECT uid FROM users WHERE email LIKE '%@verify.local' OR email LIKE 'e2e-%@demo.onlinelearning.vn');
DELETE FROM enrollments        WHERE user_uid IN (SELECT uid FROM users WHERE email LIKE '%@verify.local' OR email LIKE 'e2e-%@demo.onlinelearning.vn');
DELETE FROM quiz_results       WHERE user_uid IN (SELECT uid FROM users WHERE email LIKE '%@verify.local' OR email LIKE 'e2e-%@demo.onlinelearning.vn');
DELETE FROM users              WHERE email LIKE '%@verify.local' OR email LIKE 'e2e-%@demo.onlinelearning.vn';
```

Chạy bằng: `npx wrangler d1 execute lms --remote --file=<file.sql>`

---

## Việc còn lại cần bạn quyết

Các mục **1, 3, 5, 6, 7, 8, 9, 10, 11, 12** ở trên vẫn cần bạn chọn phương án. Ưu tiên
cao nhất là **mục 1 (`forgot-password` không gửi được email)** — hiện tại người dùng
quên mật khẩu sẽ mất tài khoản vĩnh viễn vì không có cách nào nhận token.
