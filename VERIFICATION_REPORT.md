# Báo cáo xác minh API trên server thật

**Ngày:** 2026-09-19 (cập nhật lần 2)
**Người thực hiện:** Claude Code (theo yêu cầu của chủ dự án)
**Mục đích:** Xác minh API hoạt động đúng khi chạy thật — không chỉ dựa vào bộ test mock.

> **Cập nhật lần 2:** đã phủ **100% route** (63/63) và vá **3 lỗ hổng bảo mật**
> phát hiện qua probe phân quyền (xem §9). Bộ test mock: **226/226 pass**.

---

## 1. Môi trường kiểm thử

| Thành phần | Giá trị |
|---|---|
| Server | `node src/index.js`, `PORT=4001`, khởi động bằng `npm start` |
| Cơ sở dữ liệu | PostgreSQL **thật** — Supabase project `hgugynckgityoacmqpcj` |
| Kết nối | qua pooler `aws-0-ap-northeast-1.pooler.supabase.com:5432`, `DB_SSL=true` |
| Endpoint kiểm tra | `http://localhost:4001` |
| Node.js | v24.18.0 |
| Express | 5.1.0 |

> Dữ liệu trong DB là dữ liệu thật của đồ án: 24 khóa học, 120 bài học, 5 quiz,
> 25 câu hỏi, 8 danh mục, 1 người dùng (`abb8127b-fc22-466e-8473-51000b7f2114`, role `mentor`).

**Lưu ý quan trọng về tính xác thực:** Swagger UI có sẵn tại `/api-docs`, nhưng
tính năng Browser preview không được bật trên máy này nên tôi không bấm chuột được.
Thay vào đó, mọi kiểm tra dưới đây đều là **HTTP request thật** (`fetch`) gửi tới server
đang chạy thật, và server ghi vào **PostgreSQL thật**. Đây chính xác là những gì
Swagger UI gửi đi — cùng URL, cùng method, cùng body, cùng token.

---

## 2. Kết quả tổng hợp

| # | Hạng mục kiểm thử | Cách chạy | Kết quả |
|---|---|---|---|
| 1 | Bộ test mock | `npm test` | **226/226 pass** |
| 2 | Đọc dữ liệu trên server thật | `npm run api:read` | **32/32 pass** |
| 3 | Đối chiếu mọi câu INSERT/UPDATE với schema thật | `npm run api:sweep` | **21/21 câu chạy được, 0 lỗi** |
| 4 | E2E ghi dữ liệu đầy đủ vòng đời | `npm run api:write` | **ALL PASS** |
| 5 | **Phủ toàn bộ route** (mọi method của mọi router) | `npm run api:coverage` | **63/63 route, 77/77 kiểm tra pass** |
| 6 | **Phân quyền / bảo mật** | `npm run api:authz` | **23/23 pass** (sau khi vá §9) |

---

## 3. Kiểm thử đọc — 32/32 pass

Chạy `npm run api:read`. Bao gồm:

**Đọc dữ liệu (26 endpoint):** health, app-stats, course-categories, courses (list/detail/by-mentor),
lessons (by-course/detail), enrollments (by-user/check/progress), quizzes (3 endpoint + alias cũ),
questions, quiz-results (theo user + theo id), reviews, notifications, bookmarks, mentor-requests,
users (list/listmentor/checkactive/detail).

**Kiểm tra bảo mật (6 trường hợp):**

| Trường hợp | Kỳ vọng | Kết quả thực tế |
|---|---|---|
| Đọc bookmark của uid khác (token role `user`) | 403 | ✅ 403 |
| `GET /api/courses/abc` (param không phải số) | 400 | ✅ 400 |
| `GET /api/lessons/detail/abc` | 400 | ✅ 400 |
| `GET /api/course-categories/abc` | 404 | ✅ 404 |
| `GET /api/courses` không có token | 401 | ✅ 401 |
| Dev-key bypass (`x-dev-api-key`) | 200 | ✅ 200 |

> Không còn trường hợp nào trả 500 cho dữ liệu đầu vào không hợp lệ.

---

## 4. Lỗi thật đã phát hiện và sửa

Tất cả lỗi dưới đây **không thể phát hiện bằng bộ test mock** (vì mock không biết schema thật),
và **đã được sửa**, sau đó xác minh lại trên server thật.

### 4.1. `req.body` là `undefined` → hàng loạt endpoint 500

**File:** `src/app.js`

Express 5 đặt `req.body = undefined` khi request không có body (Express 4 luôn cho `{}`).
Khoảng 30 controller đọc thẳng `req.body.uid`, nên mọi request không body đều ném
`TypeError: Cannot read properties of undefined` → **500**.

Đây là lỗi nghiêm trọng nhất: nó phá **toàn bộ** endpoint xoá (`DELETE`) với client
không gửi body — đúng cách một REST client bình thường gọi API.

*Bằng chứng trước khi sửa:*
```
DELETE /api/courses/delete/999      (không body) -> 500
DELETE /api/courses/delete/999      (body {})   -> 404   ← đúng
```

*Bằng chứng sau khi sửa:* `DELETE` không body trả 404/200 như mong đợi.

**Sửa:** thêm middleware chuẩn hoá `req.body` về `{}` trong `src/app.js`.

---

### 4.2. `completeLesson` — sai tên cột **và** sai `ON CONFLICT`

**File:** `src/controllers/lessons/completeLesson.js`

Hai lỗi độc lập trên cùng một câu SQL:

1. **Cột không tồn tại.** Câu lệnh ghi vào `lesson_progress (…, created_at)`, nhưng
   bảng thật **không có cột `created_at`** → `42703 column does not exist`.
2. **Sai target của `ON CONFLICT`.** Code dùng `ON CONFLICT (user_uid, lesson_id)`,
   nhưng DB thật chỉ có unique index `uq_lesson_progress_user_course_lesson`
   trên `(user_uid, course_id, lesson_id)` → `42P10`.

*Bằng chứng:*
```
POST /api/lessons/complete -> 500
{"error":"Lỗi đánh dấu hoàn thành: column \"created_at\" of relation \"lesson_progress\" does not exist"}
```
Kiểm tra trực tiếp DB:
```
INSERT … lesson_progress … ON CONFLICT (user_uid, lesson_id)
  ❌ there is no unique or exclusion constraint matching the ON CONFLICT specification
```

**Sửa:** bỏ `created_at`, đổi target thành `ON CONFLICT (user_uid, course_id, lesson_id)`.
Sau khi sửa: `POST /api/lessons/complete` → **200**.

*Phụ:* bọc `ROLLBACK` trong `try/catch` để lỗi `client.connect()` không bị che bởi
lỗi "SAVEPOINT can only be used in transaction blocks".

---

### 4.3. `gradeQuizResult` — ghi vào cột không tồn tại

**File:** `src/controllers/quizResults/gradeQuizResult.js`

Code ghi `graded_by_uid = $3` (kiểu text), nhưng cột thật là
**`graded_by`** (kiểu `int4`, khoá ngoại → `users.id`). Chấm điểm quiz **luôn 500**.

*Bằng chứng:*
```
PATCH /api/quiz-results/quiz-results/1/grade -> 500
{"error":"Lỗi khi chấm điểm bài kiểm tra: column \"graded_by_uid\" of relation \"quiz_results\" does not exist"}
```

**Sửa:** đổi truy vấn lấy `SELECT id, role FROM users` và ghi `graded_by = $3` bằng
`users.id` (số), không phải uid dạng chuỗi. Sau khi sửa: → **200**.

> ⚠️ **Bài học:** test mock `test/api/quiz-results.test.js` đã **khẳng định sai**
> (`assert.match(sql, /graded_by_uid/)`) nên test xanh trong khi API thật hỏng.
> Test này đã được sửa lại để khẳng định `graded_by` và **cấm** `graded_by_uid`.

---

### 4.4. `changeCourseStatus` — biến chưa khai báo

**File:** `src/controllers/courses/changeCourseStatus.js`

Hàm dùng `rejectionReason` ở 3 chỗ nhưng **chưa bao giờ khai báo** — chỉ có
`const { status } = req.body;`. Khi admin **từ chối** khóa học kèm lý do, dòng
`!rejectionReason` ném `ReferenceError` → 500.

**Sửa:** `const { status, rejectionReason } = req.body;`.

---

### 4.5. Đối chiếu toàn bộ câu ghi với schema thật (sweep)

Để chắc chắn không sót cột sai nào, tôi chạy **tất cả 21 câu INSERT/UPDATE của ứng dụng**
vào DB thật trong một transaction rồi `ROLLBACK` (không thay đổi dữ liệu).

Kết quả cuối cùng: **21/21 câu chạy thành công, 0 lỗi.**
Trước khi sửa, 2 câu hỏng (chính là §4.2 và §4.3).

---

## 5. Bất nhất thiết kế đã phát hiện (đã giải quyết ở lần 2)

### Dev-key tạo token admin nhưng không thao tác được như admin

**Mức độ:** ảnh hưởng môi trường dev, **không** ảnh hưởng production.

Dev-key (`x-dev-api-key`) tạo `req.user = { uid: "dev-admin", role: "admin" }`
**mà không cần user tồn tại trong DB**. Một số controller tin `req.user.role`
(`GET /api/users` → 200 OK), nhưng controller khác lại truy vấn role **từ DB**:

```
PATCH /api/courses/77/status   (bằng dev-key)
-> 403 {"error":"Bạn không có quyền cập nhật trạng thái khóa học"}
```

Nguyên nhân: `changeCourseStatus` chạy `SELECT role FROM users WHERE uid = $1` với
`uid = "dev-admin"` → không có row → `userRole` là `undefined` → 403.

**Đây không phải lỗi bảo mật** (nó chặn, không cho qua) và **không ảnh hưởng JWT thật** —
khi đăng nhập thật, uid luôn tồn tại trong DB nên hành vi đúng. Nó chỉ gây khó chịu khi
test nhanh bằng dev-key: một số endpoint admin chạy được, một số không.

**Hướng xử lý (chọn 1):**
- **(a) Không làm gì** — dev-key chỉ để test nhanh, hành vi hiện tại là chấp nhận được.
- **(b) Cho dev-key tạo user** `dev-admin` trong DB khi khởi động.
- **(c) Thống nhất** mọi controller lấy role từ token (`req.user.role`). Đây là thay đổi
  lớn, chạm nhiều file, và **giảm** kiểm soát an toàn — không khuyến nghị.

Tôi đề xuất **(a)** hoặc **(b)**. Chưa tự sửa vì đây là quyết định thiết kế.

> **Đã giải quyết ở lần 2:** sau khi vá §9.1 (middleware đối chiếu role với DB),
> dev-key vẫn hoạt động như cũ trong môi trường dev, nhưng hành vi "token khai admin
> mà không có user trong DB thì bị chặn" giờ là **quy tắc chung** — không còn chuyện
> mỗi controller xử lý một kiểu. Dev-key (`x-dev-api-key`) vẫn qua được vì nó **bỏ qua**
> hẳn bước tra DB (đúng thiết kế: chỉ dùng khi `NODE_ENV !== production`).

---

## 6. Dọn dẹp dữ liệu

Mọi dữ liệu test (tiền tố `LIVE-E2E-`, notification sinh ra khi đăng ký/chấm điểm)
đã được xoá. DB đã trở về **đúng trạng thái ban đầu**:

```
bookmarks 0 · course_categories 8 · course_reviews 0 · courses 24
enrollments 0 · lesson_progress 0 · lessons 120 · notifications 0
quiz_questions 25 · quiz_results 0 · quizzes 5
upgrade_requests 0 · users 1
```

Kiểm tra tự động bằng `npm run api:leftover` (đối chiếu cả DB lẫn Firebase) sau mỗi
lần chạy `api:coverage` / `api:write` / `api:authz`.

**Lưu ý về an toàn dữ liệu:** `api:authz` và `api:coverage` chỉ ghi vào dữ liệu do
chính chúng tạo ra (`user test`, `khóa học test`) — không bao giờ nhắm vào 24 khóa học
hay user mentor thật. Cả hai đều kiểm tra lại **user thật còn nguyên `role=mentor`,
`is_active=true`** và đếm lại số khóa học thật (phải đúng 24) trước khi kết thúc.

---

## 7. Cách bạn tự tái lập kết quả

```bash
# 1. Khởi động server thật
PORT=4001 npm start
```

```bash
# 2. Test mock (không cần DB)
npm test
```

```bash
# 3. Đọc dữ liệu trên server thật (32 kiểm tra)
npm run api:read
```

```bash
# 4. E2E ghi dữ liệu: tạo → sửa → xoá toàn bộ vòng đời, tự dọn
npm run api:write
```

```bash
# 5. Đối chiếu mọi câu ghi với schema thật (chạy trong transaction rồi ROLLBACK)
npm run api:sweep
```

```bash
# 6. Phủ toàn bộ 63 route (tự tạo + dọn dữ liệu test)
npm run api:coverage
```

```bash
# 7. Kiểm tra phân quyền (tự tạo + dọn user test)
npm run api:authz
```

Hoặc bấm trực tiếp trên Swagger UI: **http://localhost:4001/api-docs** — bấm
**Authorize**, dán giá trị `DEV_API_KEY` trong `.env`.

> ⚠️ `npm run api:cleanup` **xoá dữ liệu thật** (xem cảnh báo trong đầu file script).
> Chỉ chạy trên DB dev.

---

## 8. Độ phủ route — 63/63

`npm run api:coverage` đọc trực tiếp `router.stack` của mọi router đã mount trong
`src/app.js` (nguồn chân lý, không phải danh sách viết tay), gọi **từng method của
từng route** trên server thật, rồi đối chiếu lại. Kết quả: **77/77 kiểm tra pass,
63/63 route được phủ.**

Kịch bản đi hết một vòng đời thật: tạo user (Firebase + DB) → upload ảnh/PDF thật
qua multipart → tạo danh mục → khóa học → bài học → quiz → câu hỏi → đăng ký học →
hoàn thành bài → nộp bài → chấm điểm → đánh giá → bookmark → thông báo → yêu cầu
nâng cấp → **xoá sạch theo thứ tự an toàn với khóa ngoại**.

Script tự dọn cả những bản ghi phụ do controller sinh ra (notification khi tạo danh
mục/đăng ký/duyệt khóa học) và **luôn dọn user test khỏi cả DB lẫn Firebase**.

---

## 9. Lỗ hổng bảo mật đã phát hiện và vá

`npm run api:authz` phát hiện 3 lỗ hổng **cùng một gốc**: `auth.middleware` chỉ
verify chữ ký JWT rồi tin `role` trong token, **không đối chiếu DB**.

### 9.1. Quyền bị thu hồi vẫn dùng được — và token cho uid không tồn tại vẫn qua

```
# Token khai role admin, uid KHÔNG có trong DB
GET /api/users/            -> 200  ❌  (phải bị chặn)
GET /api/mentor-requests/  -> 200  ❌  (phải bị chặn)
```

```
# Admin bị hạ quyền trong DB, token cũ (khai admin) vẫn dùng được
UPDATE users SET role='user' WHERE uid=...
GET /api/users/            -> 200  ❌  (phải là 403)
```

**Hệ quả thật:** JWT có hạn **7 ngày** (`loginUser`). Một admin bị cách chức vẫn
giữ toàn quyền admin tối đa 7 ngày. Và vì role trong token được tin tuyệt đối, chỉ
cần một token còn hạn là đủ — không cần user tồn tại.

### 9.2. Tài khoản bị khoá vẫn truy cập được

```
UPDATE users SET is_active=false WHERE uid=...
GET /api/users/<uid>       -> 200  ❌  (phải là 403)
```

`is_active` **chỉ được kiểm lúc đăng nhập**. Sau đó token cũ vẫn dùng bình thường —
nên "khoá tài khoản" không có tác dụng ngay, kẻ bị khoá vẫn dùng được tới 7 ngày.

### Cách vá

Thêm `src/services/authUserLookup.js` tra `role, is_active` từ DB, và
`auth.middleware` gọi nó sau khi verify chữ ký:

| Tình huống | Trước | Sau |
|---|---|---|
| uid không có trong DB | lọt qua (200) | **401** `Tài khoản không tồn tại` |
| `is_active = false` | lọt qua (200) | **403** `Tài khoản đã bị khoá` |
| role trong token khác DB | tin token | **lấy role từ DB** |
| DB tra cứu lỗi | — | **503** (không cho qua khi không kiểm tra được) |

**Role giờ lấy từ DB là nguồn chân lý duy nhất**, nên không còn chuyện controller
này kiểm token, controller kia kiểm DB (vấn đề nêu ở §5) — mọi controller đọc
`req.user.role` đều nhận giá trị đúng.

*Xác minh sau khi vá:* `npm run api:authz` → **23/23 pass**. Ba test hồi quy được
thêm vào `test/api/auth-guard.test.js`; đã kiểm chứng chúng **thất bại** khi tắt
phần đối chiếu DB (`AUTH_SKIP_DB_CHECK=true`) — tức là test thực sự bảo vệ lỗ hổng,
không phải test hình thức.

### 9.3. Rủi ro còn lại (chưa xử lý, thuộc quyết định thiết kế)

- **Blacklist token nằm trong RAM** (`new Set()` trong `auth.middleware.js`) — mất
  khi restart, và không dùng chung giữa nhiều instance. Comment trong code đã ghi
  rõ "nên lưu trong Redis/DB cho production".
- **Mỗi request tốn thêm 1 truy vấn DB** để tra role/is_active. Chấp nhận được ở quy
  mô đồ án; nếu cần tối ưu thì thêm cache ngắn (5–30s) trong `authUserLookup.js`.

---

## 10. Kết luận

API đã **được xác minh chạy đúng trên server thật + PostgreSQL thật**:

- **226/226** test mock pass (thêm 3 test hồi quy cho lỗ hổng §9)
- **32/32** kiểm tra đọc pass (gồm 6 kiểm tra bảo mật/validate)
- **21/21** câu ghi khớp schema thật
- **ALL PASS** E2E ghi dữ liệu đầy đủ vòng đời
- **63/63 route** được phủ, 77/77 kiểm tra pass
- **23/23** kiểm tra phân quyền pass

Hai bài học lớn từ quá trình này:

1. **Test mock xanh không chứng minh API chạy thật.** 221 test mock xanh trong khi
   **4 lỗi nghiêm trọng** vẫn tồn tại — trong đó 1 lỗi (ghi vào cột `graded_by_uid`
   không tồn tại) được test mock **khẳng định là đúng**, tức test còn khoá lỗi vào.
2. **Test bảo mật cũng phải được kiểm chứng.** Các lỗ hổng §9 chỉ lộ ra khi tôi chủ
   động ký **token sai lệch có chủ đích** (role admin cho uid không tồn tại, token cũ
   sau khi hạ quyền) — không một test chức năng nào phát hiện được.

Mọi dữ liệu test đã được dọn; DB đã trở về **đúng trạng thái ban đầu**
(§6) sau mỗi lần chạy.
