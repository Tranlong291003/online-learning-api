# 🗂️ Phân tích chức năng API → Màn hình FE

> Tài liệu tổng hợp **62 endpoint / 13 module** để phân tích số lượng chức năng và lập kế hoạch xây dựng màn hình Frontend (React Native).
> Chi tiết request/response: xem `API_DOCUMENTATION.md`.

---

## 1. Tổng quan

| Nhóm | Số API | Chức năng chính |
|---|---|---|
| Auth & Users | 10 | Đăng ký, đăng nhập, hồ sơ, quản lý user |
| Course Categories | 4 | Danh mục khóa học |
| Courses | 7 | Khóa học + duyệt trạng thái |
| Lessons | 6 | Bài học + tiến độ |
| Enrollments | 5 | Đăng ký học + tiến độ |
| Quizzes | 5 | Bài kiểm tra |
| Questions | 5 | Câu hỏi (manual + AI) |
| Quiz Results | 4 | Nộp bài, chấm điểm, xem kết quả |
| Reviews | 4 | Đánh giá khóa học |
| Bookmarks | 3 | Lưu khóa học |
| Notifications | 4 | Thông báo |
| Mentor Requests | 3 | Yêu cầu nâng cấp mentor |
| App Stats | 1 | Thống kê theo role |
| **Tổng** | **62** | — |

---

## 2. Chi tiết từng API và mục đích

### 2.1 Auth & Users — `/api/users` (10 API)

| API | Chức năng | Ai dùng |
|---|---|---|
| `POST /create` | Đăng ký tài khoản (tạo Firebase + DB) | User |
| `POST /login` | Đăng nhập (Firebase idToken → JWT) | User |
| `GET /listmentor` | Danh sách mentor | Mọi user |
| `GET /` | Danh sách toàn bộ user | Admin |
| `GET /checkactive/:uid` | Kiểm tra tài khoản bị khóa? | Mọi user |
| `GET /:id` | Chi tiết hồ sơ user | Mọi user |
| `PUT /update/:id` | Cập nhật hồ sơ + avatar | Chủ tài khoản |
| `PUT /updaterole` | Đổi role (user/mentor/admin) | Admin |
| `PATCH /:id/status` | Khóa / mở tài khoản | Admin |
| `DELETE /delete/:id` | Xóa user | Admin |

### 2.2 Course Categories — `/api/course-categories` (4 API)

| API | Chức năng |
|---|---|
| `GET /` | Danh sách danh mục kèm số khóa học (dùng cho menu lọc, trang home) |
| `POST /create` | Tạo danh mục (icon) |
| `PUT /update/:category_id` | Sửa danh mục |
| `DELETE /delete/:category_id` | Xóa danh mục |

### 2.3 Courses — `/api/courses` (7 API)

| API | Chức năng |
|---|---|
| `GET /` | Danh sách khóa học: lọc theo trạng thái/danh mục/tìm kiếm, phân nhóm pending/approved/rejected |
| `GET /mentor/:instructor_uid` | Khóa học của 1 mentor (trang "khóa học của tôi" bên mentor) |
| `GET /:course_id` | Chi tiết khóa học: rating, số học viên, tổng thời lượng, bài học |
| `POST /create` | Tạo khóa học (thumb, status = pending) |
| `PUT /update/:course_id` | Sửa khóa học |
| `PATCH /:course_id/status` | Duyệt / từ chối khóa học (admin) + re-submit (mentor) |
| `DELETE /delete/:course_id` | Xóa khóa học + toàn bộ dữ liệu liên quan |

### 2.4 Lessons — `/api/lessons` (6 API)

| API | Chức năng |
|---|---|
| `GET /courses/:course_id/:userUid` | Danh sách bài học kèm trạng thái đã hoàn thành của user |
| `GET /detail/:lessonId` | Chi tiết 1 bài học (video/pdf/slide) |
| `POST /create` | Tạo bài học (video YouTube tự lấy duration, file pdf/slide) |
| `PUT /update/:lesson_id` | Sửa bài học |
| `DELETE /delete/:lesson_id` | Xóa bài học |
| `POST /complete` | Đánh dấu hoàn thành bài học |

### 2.5 Enrollments — `/api/enrollments` (5 API)

| API | Chức năng |
|---|---|
| `POST /register` | Đăng ký học 1 khóa học |
| `GET /user/:uid` | "Khóa học của tôi": danh sách đã đăng ký, phân nhóm đang học / hoàn thành, kèm % tiến độ |
| `GET /check/:uid/:course_id` | Kiểm tra user đã đăng ký khóa học chưa (để hiện nút "Đăng ký"/"Vào học") |
| `GET /progress?userUid=&courseId=` | Tiến độ chi tiết của 1 khóa học |
| `DELETE /delete/:enrollment_id` | Hủy đăng ký |

### 2.6 Quizzes — `/api/quizzes` (5 API)

| API | Chức năng |
|---|---|
| `GET /getquizbycourse/:course_id` | Danh sách quiz của khóa học + số câu hỏi, điểm trung bình, tỉ lệ đạt |
| `POST /create` | Tạo quiz (trắc nghiệm / tự luận) |
| `PUT /update/:quiz_id` | Sửa quiz |
| `DELETE /delete/:quiz_id` | Xóa quiz |
| `GET /getquizuser/:user_uid` | Quiz của các khóa học user đã đăng ký vs chưa đăng ký (trang "Bài kiểm tra" của user) |

### 2.7 Questions — `/api/questions` (5 API)

| API | Chức năng |
|---|---|
| `GET /:quiz_id` | Danh sách câu hỏi của quiz |
| `POST /createbyuser` | Tạo câu hỏi thủ công |
| `POST /createbyai` | Tạo câu hỏi tự động bằng AI (nhập topic, số lượng, độ khó) |
| `PUT /update/:question_id` | Sửa câu hỏi |
| `DELETE /delete/:question_id` | Xóa câu hỏi |

### 2.8 Quiz Results — `/api/quiz-results` (4 API)

| API | Chức năng |
|---|---|
| `POST /submit` | Nộp bài: trắc nghiệm tự chấm ngay, tự luận chờ chấm |
| `GET /users/:user_uid/results` | Lịch sử làm bài của user (điểm, đạt/không) |
| `GET /:result_id` | Chi tiết bài làm: từng câu, đáp án, đúng/sai, giải thích AI |
| `PATCH /quiz-results/:result_id/grade` | Mentor/admin chấm bài tự luận |

### 2.9 Reviews — `/api/reviews` (4 API)

| API | Chức năng |
|---|---|
| `GET /course/:courseId` | Danh sách đánh giá của khóa học |
| `POST /create` | Viết đánh giá (sao + bình luận) |
| `PUT /update/:reviewId` | Sửa đánh giá |
| `DELETE /delete/:reviewId` | Xóa đánh giá |

### 2.10 Bookmarks — `/api/bookmarks` (3 API)

| API | Chức năng |
|---|---|
| `GET /:user_uid` | Danh sách khóa học đã lưu |
| `POST /create` | Lưu khóa học |
| `DELETE /delete` | Bỏ lưu |

### 2.11 Notifications — `/api/notifications` (4 API)

| API | Chức năng |
|---|---|
| `POST /create` | Tạo thông báo (hệ thống nội bộ) |
| `POST /` | Danh sách thông báo của user |
| `POST /mark-read` | Đánh dấu đã đọc |
| `DELETE /delete/:id` | Xóa thông báo |

### 2.12 Mentor Requests — `/api/mentor-requests` (3 API)

| API | Chức năng |
|---|---|
| `POST /` | User gửi yêu cầu nâng cấp mentor (kèm ảnh minh chứng) |
| `GET /` | Danh sách yêu cầu (admin duyệt) |
| `PUT /:id/status` | Duyệt / từ chối (duyệt thì tự nâng role thành mentor) |

### 2.13 App Stats — `/api/app-stats` (1 API)

| API | Chức năng |
|---|---|
| `POST /` | Thống kê: admin (tổng khóa học/user/quiz/review), mentor (khóa học, học viên, bài học, điểm đánh giá) |

---

## 3. Đề xuất danh sách màn hình FE (React Native)

### 3.1 Nhóm chung / Auth (2 màn)
1. **Màn Đăng nhập** — Firebase login → `POST /api/users/login`
2. **Màn Đăng ký** — `POST /api/users/create`

### 3.2 Nhóm User (11 màn)
3. **Home** — `GET /api/courses` (filter approved + search + lọc danh mục), `GET /api/course-categories`
4. **Chi tiết khóa học** — `GET /api/courses/:id`, review, nút đăng ký (`GET check` + `POST register`), bookmark
5. **Danh sách bài học** — `GET /api/lessons/courses/:id/:uid`
6. **Học bài** — `GET /api/lessons/detail/:id` (video/pdf/slide) + `POST /complete`
7. **Khóa học của tôi** — `GET /api/enrollments/user/:uid` (+ progress)
8. **Bài kiểm tra (của user)** — `GET /api/quizzes/getquizuser/:uid`
9. **Làm bài quiz** — `GET /api/questions/:quiz_id` + `POST /api/quiz-results/submit`
10. **Kết quả bài làm** — `GET /api/quiz-results/users/:uid/results` + `GET /api/quiz-results/:id`
11. **Bookmark** — `GET /api/bookmarks/:uid`
12. **Thông báo** — `GET /api/notifications` (+ mark-read, delete)
13. **Hồ sơ / Chỉnh sửa hồ sơ** — `GET /:id`, `PUT /update/:id` + màn gửi yêu cầu mentor (`POST /api/mentor-requests`)

### 3.3 Nhóm Mentor (5 màn)
14. **Dashboard mentor** — `POST /api/app-stats`
15. **Quản lý khóa học của tôi** — `GET /api/courses/mentor/:uid`, `POST/PUT/DELETE /api/courses`
16. **Quản lý bài học** — CRUD `/api/lessons`
17. **Quản lý quiz & câu hỏi** — CRUD `/api/quizzes`, `/api/questions` (+ tạo bằng AI)
18. **Chấm bài tự luận** — `PATCH /api/quiz-results/quiz-results/:id/grade` + danh sách bài chờ chấm (nối thêm)

### 3.4 Nhóm Admin (5 màn)
19. **Dashboard thống kê** — `POST /api/app-stats` (role admin)
20. **Duyệt khóa học** — `GET /api/courses?status=pending` + `PATCH /:id/status`
21. **Quản lý user** — `GET /api/users`, khóa/mở (`PATCH status`), đổi role (`PUT updaterole`), xóa
22. **Duyệt mentor request** — `GET /api/mentor-requests` + `PUT /:id/status`
23. **Quản lý danh mục** — CRUD `/api/course-categories`

---

## 4. Thống kê nhanh

| Hạng mục | Số lượng |
|---|---|
| Tổng API | 62 |
| Tổng màn hình đề xuất | **23** (2 auth + 11 user + 5 mentor + 5 admin) |
| Màn dùng chung giữa các role | Home, Chi tiết khóa học, Hồ sơ, Thông báo, Danh sách bài học |

> Màn hình có thể gộp lại, ví dụ "Bài kiểm tra" + "Kết quả" thành 1 luồng; "Quản lý quiz & câu hỏi" gộp vào màn Quản lý khóa học. Tối thiểu có thể xuống **~14–16 màn** tùy độ chi tiết.
