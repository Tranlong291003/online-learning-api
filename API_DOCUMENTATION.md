# 📘 Tài liệu API – Online Learning Platform

> Tài liệu dành cho Frontend (React Native / Web) tích hợp lại API.
> Trạng thái: khớp 100% với mã nguồn hiện tại (đã xác minh bằng 269 test tự động).

---

## 1. Thông tin chung

| Mục | Giá trị |
|---|---|
| Base URL (dev) | `http://localhost:3000` |
| Base URL (production) | theo môi trường deploy (Render/Docker) |
| Định dạng | `JSON`, upload file dùng `multipart/form-data` |
| Swagger UI | `GET {BASE_URL}/api-docs` |
| Health check | `GET {BASE_URL}/health` → `{ status: "ok", timestamp }` |

Các file tĩnh (ảnh, PDF, slide) được trả về dạng đường dẫn tương đối bắt đầu bằng `/uploads/...`. Khi hiển thị, FE ghép với base URL: `{BASE_URL}{avatar_url}`.

---

## 2. Xác thực (Authentication)

### 2.1 Luồng đăng nhập

API **tự quản lý tài khoản** (email + mật khẩu hash bằng bcrypt). Không còn dùng
Firebase Auth — Firebase chỉ còn dùng để gửi push notification (FCM).

1. Gọi `POST /api/auth/login` với `{ email, password }`.
2. Server trả về **cặp token**:
   - `access_token` — JWT, hạn **15 phút**
   - `refresh_token` — hạn **30 ngày** (90 ngày nếu gửi `remember: true`)
3. Mọi request sau đó gửi header `Authorization: Bearer <access_token>`.
4. Khi access token hết hạn, gọi `POST /api/auth/refresh` với `{ refresh_token }`
   để lấy cặp token mới.

> ⚠️ **Refresh token chỉ dùng được một lần.** Mỗi lần gọi `/refresh`, server trả
> refresh token **mới** và vô hiệu hoá token cũ (rotation). Client **phải** lưu
> token mới. Nếu token cũ bị dùng lại, server coi là bị đánh cắp và thu hồi **cả
> phiên** (`code: "SESSION_REVOKED"`).

> **Vì sao access token ngắn hạn:** JWT không thu hồi được giữa chừng. Thời hạn
> ngắn giới hạn thiệt hại nếu token bị lộ; refresh token nằm trong DB nên thu hồi
> được (đăng xuất, đổi mật khẩu, tài khoản bị khoá, admin đổi quyền).

### 2.1.1 Endpoint xác thực

| Method | Endpoint | Cần token | Mô tả |
|---|---|---|---|
| POST | `/api/auth/register` | không | Đăng ký; trả token luôn, không cần đăng nhập lại |
| POST | `/api/auth/login` | không | Đăng nhập |
| POST | `/api/auth/refresh` | không | Đổi refresh token lấy cặp token mới |
| POST | `/api/auth/forgot-password` | không | Yêu cầu đặt lại mật khẩu |
| POST | `/api/auth/reset-password` | không | Đặt lại mật khẩu bằng token |
| GET | `/api/auth/me` | có | Hồ sơ + role hiện tại của người đang đăng nhập |
| POST | `/api/auth/change-password` | có | Đổi mật khẩu (cần mật khẩu hiện tại) |
| POST | `/api/auth/logout` | có | Thu hồi phiên hiện tại, hoặc tất cả với `{ all_devices: true }` |

`POST /api/users/create` và `POST /api/users/login` vẫn hoạt động như **alias**
tương thích ngược cho app đang chạy, trỏ về cùng logic trên. Nên chuyển sang
`/api/auth/*`.

Chi tiết tích hợp phía app mobile: xem `AUTH_INTEGRATION_FLUTTER.md`.

### 2.1.2 Chống dò mật khẩu

- Sai mật khẩu quá `MAX_LOGIN_ATTEMPTS` (mặc định 10) lần liên tiếp → tài khoản bị
  tạm khoá `LOGIN_LOCK_MINUTES` (mặc định 15) phút, trả `429` với
  `code: "ACCOUNT_LOCKED"`.
- Email không tồn tại và sai mật khẩu trả **cùng một thông điệp**
  (`Email hoặc mật khẩu không đúng`) để không dò được email nào đã đăng ký.

### 2.2 Dev key (chỉ dùng khi phát triển, không dùng production)

Khi server chạy với `NODE_ENV != production` và có `DEV_API_KEY` trong `.env`, FE có thể gọi thẳng bằng:

```
x-dev-api-key: <giá-trị-DEV_API_KEY-trong-.env>
```

hoặc `Authorization: Bearer <giá-trị-DEV_API_KEY-trong-.env>`. Dev key mặc định có quyền `admin`.

### 2.3 Quy tắc chung về quyền (role)

| Role | Quyền chính |
|---|---|
| `user` | Xem khóa học/bài học, đăng ký, làm quiz, review, bookmark |
| `mentor` | Tạo/sửa/xóa **khóa học của mình**, bài học, quiz, câu hỏi |
| `admin` | Toàn quyền: duyệt khóa học, quản lý user, mentor request, thống kê |

> ✅ Quy tắc xác định người dùng: server **luôn lấy `uid` từ token** (`req.user.uid`), không tin `uid` do client gửi lên.
> - FE **không cần** gửi `uid` trong body/query nữa. Nếu vẫn gửi để tương thích: giá trị phải **trùng** với `uid` trong token, nếu khác sẽ bị trả `403` (`Bạn không có quyền thao tác thay người dùng khác`).
> - Ngoại lệ: tài khoản `admin` được phép gửi `uid` khác token để thao tác thay người dùng khác.
> - Các trường `uid` trong bảng mô tả bên dưới vì vậy là **tùy chọn** (trừ khi ghi rõ là tham số đường dẫn `:uid`).

### 2.4 Mã lỗi chuẩn

| Status | Ý nghĩa |
|---|---|
| `200 / 201` | Thành công |
| `400` | Dữ liệu không hợp lệ / thiếu trường bắt buộc |
| `401` | Chưa xác thực (thiếu/sai token hoặc dev key) |
| `403` | Không có quyền (role không đủ / không phải chủ sở hữu) |
| `404` | Không tìm thấy tài nguyên |
| `409` | Xung đột ràng buộc dữ liệu (vd: xóa danh mục đang có khóa học) |
| `429` | Bị chặn tạm thời — tài khoản khoá do đăng nhập sai quá nhiều lần |
| `500` | Lỗi server |

Định dạng lỗi thường là `{ "error": "..." }` (một số chỗ cũ dùng `{ "message": "..." }` — FE nên đọc cả 2 trường). Một số lỗi xác thực kèm thêm `code` để client xử lý tự động:

| `code` | Khi nào | Client nên làm gì |
|---|---|---|
| `TOKEN_EXPIRED` | Access token hết hạn | Gọi `/api/auth/refresh` rồi phát lại request |
| `REFRESH_TOKEN_EXPIRED` | Refresh token hết hạn | Đăng xuất, về màn đăng nhập |
| `SESSION_REVOKED` | Phiên bị thu hồi | Đăng xuất, về màn đăng nhập |
| `ACCOUNT_LOCKED` | Sai mật khẩu quá nhiều lần | Hiện thời gian còn lại |

---

## 3. Users — `/api/users`

> Đăng ký / đăng nhập / làm mới token đã chuyển sang `/api/auth/*` (mục 2.1.1).
> Hai alias `POST /api/users/create` và `POST /api/users/login` vẫn chạy.

### 3.1 Danh sách user — `GET /api/users` *(chỉ admin)*
→ `200`: `{ message, users: [{ uid, name, avatar_url, role, bio, is_active }] }`

### 3.2 Danh sách mentor — `GET /api/users/listmentor`
→ `200`: `{ message, mentors: [{ uid, name, avatar_url, bio, email }] }`

### 3.3 Chi tiết user — `GET /api/users/:id` *(hồ sơ công khai)*
Mọi user đã đăng nhập đều xem được — app cần hiển thị trang chi tiết mentor cho học viên.
→ `200`: `{ message, user: { uid, email, name, avatar_url, bio, phone, gender, birthdate, role, created_at } }`
→ `404`: không tìm thấy.

> Không trả `is_active`, `fcm_token`, `password_hash`. Muốn biết tài khoản mình còn
> hoạt động không thì đọc từ `GET /api/auth/me`.

### 3.4 Kiểm tra tài khoản còn hoạt động — `GET /api/users/checkactive/:uid`
Chỉ **chính chủ hoặc admin** (endpoint này lộ trạng thái bị khoá).
→ `200`: `{ is_active: true }` · `404` không tìm thấy · `403` nếu hỏi về người khác.

### 3.5 Cập nhật hồ sơ — `PUT /api/users/update/:id`
- **multipart/form-data**: `avatar` (file) hoặc các field: `name`, `bio`, `phone`, `gender`, `birthdate` (YYYY-MM-DD)
- Quyền: chủ sở hữu hoặc admin (kiểm tra từ **token**).
- → `200`: `{ message, user, notification: { noti_id, title, body, sent } }`
- → `403` khi sửa người khác; `400` khi không có dữ liệu.

### 3.6 Đổi role — `PUT /api/users/updaterole` *(chỉ admin)*
Body: `{ uid, role }` (`role`: `user | mentor | admin`)
→ `200`: `{ success: true, message }`. Thu hồi mọi phiên của người bị đổi quyền.

### 3.7 Khóa/mở tài khoản — `PATCH /api/users/:id/status` *(chỉ admin)*
Body: `{ status: "active" | "disabled" }`
→ `200`: `{ message }`. Khoá tài khoản cũng thu hồi mọi phiên đang mở.

### 3.8 Xóa user — `DELETE /api/users/delete/:id` *(chỉ admin)*
→ `200`: `{ message }`; `409` khi user còn dữ liệu liên quan (khóa học, review…).

---

## 4. Danh mục khóa học — `/api/course-categories`

| Method & Path | Quyền | Body / Query | Response 200/201 |
|---|---|---|---|
| `GET /` | đã xác thực | — | `{ message, data: [{ category_id, name, description, created_at, updated_at, icon, course_count }] }` |
| `POST /create` | mentor/admin | multipart: `name`, `description?`, `icon?` (file) | `201 { message, category_id, notification }` |
| `PUT /update/:category_id` | mentor/admin | multipart: `name`, `description?`, `uid`, `icon?` | `200 { message }` |
| `DELETE /delete/:category_id` | mentor/admin | body: `{ uid }` | `200 { message }`, `409` nếu đang có khóa học |

---

## 5. Khóa học — `/api/courses`

### 5.1 Danh sách khóa học — `GET /api/courses`
Query (tùy chọn): `status` (`pending|approved|rejected|all`), `category` (id), `search` (từ khóa — khớp tiêu đề/tên giảng viên/tên danh mục)
→ `200`:
```json
{ "data": {
    "pending":  [ { course }, ... ],
    "approved": [ { course }, ... ],
    "rejected": [ { course }, ... ]
  },
  "total": 24 }
```
Mỗi `course` gồm: `course_id, title, instructor_uid, category_id, price, level, discount_price, thumbnail_url, status, rejection_reason, updated_at, instructor_name, instructor_avatar, category_name, rating, enroll_count, lesson_count, total_duration` (định dạng `HH:MM:SS`).

### 5.2 Khóa học của mentor — `GET /api/courses/mentor/:instructor_uid`
→ giống 5.1 (mỗi course thêm `description, language, created_at, approved_at, instructor_bio, review_count, discount_percent`).

### 5.3 Chi tiết khóa học — `GET /api/courses/:course_id`
→ `200`: `{ message, data: { course_id, title, description, level, language, tags, price, discount_price, status, approved_at, thumbnail_url, created_at, updated_at, rejection_reason, category_id, category_name, instructor_uid, instructor_name, instructor_avatar_url, instructor_bio, avg_rating, review_count, enrollment_count, total_video_duration, last_lesson_update, lesson_count, discount_percent, last_update } }`

### 5.4 Tạo khóa học — `POST /api/courses/create` *(mentor/admin)*
multipart: `thumbnail` (file) + fields: `title*`, `category_id*`, `level*` (`beginner|intermediate|advanced`), `description?`, `price?`, `discount_price?`, `language?`, `tags?`
→ `201`: `{ message, course: { ...trường của khóa học, instructor_name } }` — status mặc định `pending`.

### 5.5 Cập nhật khóa học — `PUT /api/courses/update/:course_id` *(mentor sở hữu / admin)*
multipart: `thumbnail?` + fields: `title?`, `description?`, `level?`, `price?`, `discount_price?`, `language?`, `tags?`, `uid*`
→ `200`: `{ message, data: course }`
→ `403` khi mentor sửa khóa học của người khác.

### 5.6 Duyệt khóa học — `PATCH /api/courses/:course_id/status`
Body: `{ uid, status, rejectionReason? }`
- `admin`: set bất kỳ trạng thái nào.
- `mentor`: chỉ được đổi `rejected → pending` cho khóa của mình.
→ `200`: `{ message, ... }` (kèm gửi thông báo FCM cho giảng viên khi admin duyệt/từ chối).

### 5.7 Xóa khóa học — `DELETE /api/courses/delete/:course_id` *(mentor sở hữu / admin)*
Body: `{ uid }`
→ `200`: `{ success: true, message }` (xóa transaction toàn bộ dữ liệu liên quan).

---

## 6. Bài học — `/api/lessons`

| Method & Path | Quyền | Body / Query | Response |
|---|---|---|---|
| `GET /courses/:course_id/:userUid` | đã xác thực | — | `{ message, data: [{ lesson_id, course_id, title, video_url, video_id, video_duration, pdf_url, slide_url, content, order, created_at, updated_at, creator_uid, is_completed (1|0), creator_name, creator_avatar }] }` |
| `GET /detail/:lessonId` | đã xác thực | — | `{ message, data: lesson }` |
| `POST /create` | mentor/admin | multipart: `pdf?`, `slide?` + fields `course_id*`, `title*`, `uid*`, `video_url?`, `content?`, `order?` | `201 { message, data: lesson }` — nếu có `video_url` YouTube, server tự lấy `video_id` + `video_duration` (lỗi `400` nếu URL không hợp lệ) |
| `PUT /update/:lesson_id` | mentor sở hữu/admin | như create | `200 { message, data: lesson }` |
| `DELETE /delete/:lesson_id` | mentor sở hữu/admin | body: `{ uid }` | `200 { message }` |
| `POST /complete` | user đã đăng ký | `{ courseId*, lessonId* }` (số; nhận cả `course_id`/`lesson_id`) | `200 { status: "insert"|"update", message }`; `403` chưa đăng ký |

---

## 7. Đăng ký khóa học — `/api/enrollments`

| Method & Path | Body / Query | Response |
|---|---|---|
| `POST /register` | `{ userUid*, courseId* }` | `201 { message, enrollment_id, notification }`; `400` đã đăng ký rồi |
| `GET /user/:uid` | — | `{ message, data: { in_progress: [course], completed: [course] } }` — mỗi course: `course_id, title, thumbnail_url, total_lessons, completed_lessons, progress_percent, total_duration` |
| `GET /check/:uid/:course_id` | — | `{ enrolled: true|false }` |
| `GET /progress?userUid=&courseId=` | (query hoặc body đều được) | `{ message, data: { total_lessons, completed_lessons, progress_percent } }` |
| `DELETE /delete/:enrollment_id` | — | `200 { message }` |

---

## 8. Quiz — `/api/quizzes`

| Method & Path | Quyền | Body | Response |
|---|---|---|---|
| `GET /getquizbycourse/:course_id` | đã xác thực | — | `{ message, data: [{ quiz_id, title, description, type, time_limit, attempt_limit, creator_uid, created_at, updated_at, total_questions, average_score, passing_rate }] }` |
| `POST /create` | mentor/admin | `{ course_id*, title*, uid*, type? ("trac_nghiem"|"tu_luan"), time_limit?, attempt_limit? }` | `201 { message, data: quiz }` |
| `PUT /update/:quiz_id` | chủ sở hữu/admin | `{ uid*, title?, type?, time_limit?, attempt_limit? }` | `200 { message, data: quiz }` |
| `DELETE /delete/:quiz_id` | chủ sở hữu/admin | `{ uid* }` | `200 { message }` |
| `GET /getquizuser/:user_uid` | đã xác thực | — | `{ message, data: { enrolledCourses: [{ course_id, course_title, quizzes }], notEnrolledCourses: [...] } }` |

---

## 9. Câu hỏi quiz — `/api/questions`

> **Quy ước `correct_index`:** khi FE **gửi** dữ liệu (create/update) dùng **số thứ tự bắt đầu từ 1** (1 = đáp án đầu tiên). Server lưu DB dạng **0-based** (0 = đáp án đầu tiên) — tất cả response trả ra đều là **0-based** để FE so sánh trực tiếp với `options[i]`.

| Method & Path | Quyền | Body | Response |
|---|---|---|---|
| `GET /:quiz_id` | đã xác thực | — | `{ message, data: [question] }` — mỗi question: `question_id, quiz_id, question, options (chuỗi JSON đã serialize — FE parse), correct_index, expected_keywords, created_at, updated_at` |
| `POST /createbyuser` | mentor/admin | `{ quiz_id*, question*, uid*, type?, options* (array), correct_index* (1-based), expected_keywords? }` | `201 { message, data: question }` |
| `POST /createbyai` | mentor/admin | `{ quiz_id*, topic*, uid*, number? (mặc định 3), difficulty* (easy|medium|hard), type?, language? }` | `201 { message, topic, questions }` — server gọi OpenAI tạo câu hỏi |
| `PUT /update/:question_id` | mentor/admin | `{ uid*, question?, options*, correct_index* (1-based) }` (trac_nghiem); `{ uid*, question?, expected_keywords? }` (tu_luan) | `200 { message, data: question }` |
| `DELETE /delete/:question_id` | mentor/admin | `{ uid* }` | `200 { message }` |

---

## 10. Kết quả quiz — `/api/quiz-results`

### 10.1 Nộp bài — `POST /api/quiz-results/submit`
Body:
```json
{ "uid": "user-1", "quiz_id": 5,
  "answers": { "12": 0, "13": 2, "14": null },
  "explanation": "ghi chú (nếu tu_luan)" }
```
- `answers` = map `question_id → index 0-based` (khớp với `correct_index` trả về ở mục 9), `null` = bỏ qua.
- Quiz `trac_nghiem` → tự chấm ngay, `tu_luan` → status `cho_cham`.
- → `201`:
```json
{ "message": "...", "result_id": 1, "score": 8.5, "total_answered": 3,
  "correct_answers": 2, "invalid_question_ids": [],
  "questions": [{ "question_id", "question", "options", "correct_answer", "user_answer", "is_correct" }] }
```
- Điểm thang 10 = `correct/totalAnswered * 10`.

### 10.2 Danh sách kết quả của user — `GET /api/quiz-results/users/:user_uid/results`
→ `200`: `{ user_uid, total, results: [{ result_id, title, score, passed (bool), submitted_at }] }`

### 10.3 Chi tiết kết quả — `GET /api/quiz-results/:result_id`
→ `200`: `{ message, data: { quiz_id, user_uid, score, explanation, total_correct_answers, total_wrong_answers, processing_time, questions: [{ question_id, question, options, correct_answer (0-based), user_answer, is_correct, explanation }] } }`
> ⚠️ Endpoint này gọi **OpenAI để sinh giải thích** cho câu sai mỗi lần GET (worker threads, timeout 3s/câu). Nếu không có `OPENAI_API_KEY`, server trả giải thích mặc định. Lưu ý latency và chi phí khi gọi nhiều.

### 10.4 Chấm bài tự luận — `PATCH /api/quiz-results/quiz-results/:result_id/grade` *(mentor/admin)*
Body: `{ uid*, explanation*, score* }`
→ `200`: `{ message }` — set `status = da_cham`, lưu `graded_by_uid`.

---

## 11. Đánh giá khóa học — `/api/reviews`

| Method & Path | Quyền | Body | Response |
|---|---|---|---|
| `GET /course/:courseId` | đã xác thực | — | `{ data: [{ review_id, course_id, user_uid, user_name, user_avatar_url, rating, comment, created_at, updated_at }] }` |
| `POST /create` | đã xác thực | `{ course_id*, user_uid*, rating* (1–5), comment? }` | `201 { data: { review_id } }`; `400` đã review rồi |
| `PUT /update/:reviewId` | chủ review | `{ user_uid*, rating?, comment? }` | `200 { message }`; `403` không phải chủ |
| `DELETE /delete/:reviewId` | chủ review | `{ user_uid* }` | `200 { message }` |

---

## 12. Bookmark — `/api/bookmarks`

| Method & Path | Body | Response |
|---|---|---|
| `GET /:user_uid` | — | `{ data: [{ bookmark_id, course_id, course_title, course_thumbnail, created_at }] }` |
| `POST /create` | `{ courseId*, userUid* }` | `201 { data: { bookmark_id } }`; `400` đã bookmark |
| `DELETE /delete` | `{ bookmarkId*, userUid* }` (body) | `200 { data: null }`; `403` không phải chủ |

---

## 13. Thông báo — `/api/notifications`

| Method & Path | Body | Response |
|---|---|---|
| `POST /create` | `{ uid*, title*, content*, icon?, color? }` | `201` trả về notification; `400` thiếu `uid/title/content` |
| `POST /` | `{ uid* }` | `200 { notifications: [...] }` |
| `POST /mark-read` | `{ uid*, noti_id* }` | `200 { message }`; `404` không tìm thấy/không có quyền |
| `DELETE /delete/:id` | `{ uid* }` | `200 { message }`; `404` như trên |

---

## 14. Mentor request — `/api/mentor-requests`

| Method & Path | Quyền | Body | Response |
|---|---|---|---|
| `POST /` | user | multipart: `image*` (file ảnh minh chứng) + field `user_uid*` | `201 { message, image_url }`; `400` đã có request `pending` |
| `GET /` | **admin** (từ token) | query: `status?` | `200` mảng `[{ id, user_uid, status, reason, image_url, created_at, updated_at, user_name }]` |
| `PUT /:id/status` | **admin** (từ token) | `{ status: "approved"|"rejected", reason? }` | `200 { message }` — khi duyệt, server tự set role `mentor` + gửi FCM |

---

## 15. Thống kê — `/api/app-stats`

`POST /api/app-stats` — body: `{ uid* }` (hoặc `?uid=`)
- Role `admin` → `{ role: "admin", total_courses, total_users, total_quizzes, total_reviews }`
- Role `mentor` → `{ role: "mentor", total_courses, total_students, total_lessons, avg_rating }`
- Role khác → `403`.

---

## 16. Hướng dẫn tích hợp cho React Native

### 16.1 API client mẫu
```ts
// api.ts
const BASE_URL = "http://localhost:3000";

export async function api<T>(path: string, options: RequestInit = {}, token?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const message = body?.error || body?.message || `HTTP ${res.status}`;
    throw new ApiError(res.status, message, body);
  }
  return body;
}
```

### 16.2 Lưu ý quan trọng
1. **Luôn đính kèm `uid`** trong body các thao tác ghi (create/update/delete) — trừ endpoint dùng role từ token (admin: `GET /api/users`, `PATCH status`, `PUT updaterole`, `DELETE delete`, mentor-request GET/PUT status).
2. **Upload file** không dùng JSON: dùng `FormData` với đúng tên field (`thumbnail`, `icon`, `image`, `avatar`, `pdf`, `slide`).
3. **Ảnh/PDF trả về dạng đường dẫn tương đối** (`/uploads/...`) — phải ghép `BASE_URL`.
4. **`correct_index`:** gửi 1-based khi tạo/sửa câu hỏi; response trả 0-based.
5. **`answers` khi nộp quiz:** map `question_id → index 0-based`.
6. **Login:** gửi `{ email, password }` tới `/api/auth/login`. Nhận `401` khi access token hết hạn kèm `code: "TOKEN_EXPIRED"` → gọi `/api/auth/refresh` rồi phát lại request, chỉ đăng xuất khi refresh cũng thất bại.
7. **Response shape không đồng nhất giữa các endpoint** (một số bọc `{ data }`, một số trả thẳng mảng/object) — đọc kỹ từng endpoint ở trên; khai báo type riêng cho từng API.
8. **Trường hợp đặc biệt:** `GET /api/courses` trả rỗng với `{ message: "Không có khóa học" }` (không có `data`) — xử lý null-safe.
9. **Trạng thái:** course `pending | approved | rejected`; quiz result `cho_cham | da_cham`; user `active | disabled`.
10. **Điểm quiz:** thang 10 (≥5 là đạt).
