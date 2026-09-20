# Online Learning API

> RESTful API cho nền tảng học trực tuyến — Node.js, Express 5, PostgreSQL (Supabase).

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)](https://expressjs.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-4169E1?logo=postgresql&logoColor=white)](https://supabase.com)
[![Tests](https://img.shields.io/badge/tests-228%20passing-brightgreen)](#kiểm-thử)

---

## 📑 Mục lục

- [Giới thiệu](#-giới-thiệu)
- [Kiến trúc](#-kiến-trúc)
- [Tech stack](#-tech-stack)
- [Cấu trúc thư mục](#-cấu-trúc-thư-mục)
- [Bắt đầu nhanh](#-bắt-đầu-nhanh)
- [Biến môi trường](#-biến-môi-trường)
- [API](#-api)
- [Xác thực & phân quyền](#-xác-thực--phân-quyền)
- [Kiểm thử](#-kiểm-thử)
- [Triển khai](#-triển-khai)
- [Quy ước Git](#-quy-ước-git)

---

## 🚀 Giới thiệu

Backend cho hệ thống học trực tuyến, cung cấp REST API phục vụ:

| Module | Mô tả |
| --- | --- |
| 🔐 **Users** | Tài khoản, vai trò (admin/mentor/user), mentor request |
| 📚 **Courses** | Khóa học, danh mục, duyệt khóa học |
| 📖 **Lessons** | Bài học, video (YouTube), tài liệu PDF/slide, tiến độ |
| 🎓 **Enrollments** | Đăng ký khóa học, theo dõi tiến độ |
| 📝 **Quizzes** | Bài kiểm tra, câu hỏi (thủ công + AI), chấm điểm |
| 💬 **Reviews** | Đánh giá khóa học |
| 🔖 **Bookmarks** | Lưu khóa học yêu thích |
| 🔔 **Notifications** | Thông báo + push qua Firebase Cloud Messaging |
| 📊 **App stats** | Thống kê tổng quan |

## 🏗 Kiến trúc

```
   Mobile app / Swagger UI
              │
              ▼
   ┌────────────────────────┐
   │  VERCEL (serverless)   │   Chạy code Node/Express:
   │  src/app.js            │   xử lý request, JWT, phân quyền
   └────────────────────────┘
              │
              │  DATABASE_URL (Postgres)
              ▼
   ┌────────────────────────┐
   │  SUPABASE (database)   │   Chỉ lưu dữ liệu
   │  public.courses, ...   │
   └────────────────────────┘
```

Luồng request: `routes → middleware (auth) → controllers → PostgreSQL`.

Kết nối database dùng **`pg` Pool** qua `DATABASE_URL` (không dùng Supabase SDK). Vì vậy
phân quyền do **tầng middleware + controller** đảm nhiệm, không dựa vào Row Level Security.

## 🧰 Tech stack

| Thành phần | Công nghệ |
| --- | --- |
| Runtime | Node.js ≥ 22 |
| Web framework | Express 5 |
| Database | PostgreSQL (Supabase) qua `pg` |
| Xác thực | JWT tự ký (`jsonwebtoken`) + Firebase Authentication cho đăng nhập |
| Upload file | Multer (avatar, thumbnail, PDF, slide) |
| Push notification | Firebase Admin SDK |
| AI | OpenAI (sinh câu hỏi quiz) |
| Tài liệu API | Swagger UI (`/api-docs`) |
| Kiểm thử | `node --test` |

## 📁 Cấu trúc thư mục

```
src/
├── app.js                 # Khai báo Express app, mount routes, middleware chung
├── index.js               # Điểm khởi động (có guard cho Vercel serverless)
├── config/
│   ├── db.config.js       # Pool kết nối PostgreSQL
│   ├── firebase.config.js # Firebase Admin (đọc key từ env hoặc file)
│   ├── multer.*.config.js # Cấu hình upload theo từng loại
│   └── swagger.config.js  # Sinh OpenAPI spec từ JSDoc
├── middleware/
│   ├── auth.middleware.js # Xác thực JWT + đối chiếu DB (role, is_active)
│   └── actor.js           # resolveActorUid — chống giả mạo uid
├── routes/                # Định nghĩa route theo module
├── controllers/           # Logic xử lý, chia theo module
├── services/              # Dịch vụ dùng chung (tìm user, thông báo)
├── utils/                 # Hàm tiện ích (parse id…)
└── public/uploads/        # File tĩnh đã upload

test/api/                  # Kiểm thử đơn vị (mock DB)
scripts/                   # Script kiểm thử live, seed, migrate
```

## ⚡ Bắt đầu nhanh

```bash
# 1. Cài dependencies
npm install

# 2. Tạo file .env (xem mục Biến môi trường)
cp .env.example .env
# → điền DATABASE_URL, JWT_SECRET, ...

# 3. Chạy dev server
npm run dev
```

Server chạy tại `http://localhost:3000`.

| URL | Mô tả |
| --- | --- |
| `http://localhost:3000/health` | Health check |
| `http://localhost:3000/api-docs` | Swagger UI |

## 🔑 Biến môi trường

### Bắt buộc

| Biến | Mô tả |
| --- | --- |
| `DATABASE_URL` | Chuỗi kết nối PostgreSQL. Supabase dùng pooler: `postgresql://<user>:<pass>@aws-0-<region>.pooler.supabase.com:5432/postgres` |
| `JWT_SECRET` | Khóa ký JWT, **tối thiểu 32 ký tự** |
| `DB_SSL` | `true` khi kết nối Supabase/cloud |

### Tùy chọn

| Biến | Mô tả |
| --- | --- |
| `PORT` / `HOST` | Cổng và địa chỉ lắng nghe (mặc định `3000` / `0.0.0.0`) |
| `CORS_ORIGIN` | Giới hạn origin được phép. Bỏ trống = cho phép tất cả |
| `FIREBASE_SERVICE_ACCOUNT_BASE64` | Nội dung file service account mã hoá base64. **Cần khi deploy** vì file key bị gitignore |
| `OPENAI_API_KEY` | Sinh câu hỏi quiz bằng AI |
| `YOUTUBE_API_KEY` | Lấy thông tin video bài học |
| `DEV_API_KEY` + `DEV_API_KEY_UID` / `_ROLE` | Bypass JWT cho môi trường dev. **Tự động tắt khi `NODE_ENV=production`** |
| `AUTH_SKIP_DB_CHECK` | `true` để bỏ đối chiếu DB khi xác thực (chỉ dùng cho test) |

> ⚠️ **Không commit `.env`** — đã có trong `.gitignore`. File `src/firebaseServiceAccountKey.json`
> cũng bị gitignore; trên server phải nạp qua `FIREBASE_SERVICE_ACCOUNT_BASE64`.

Tạo giá trị base64 cho Firebase:

```bash
base64 -w0 src/firebaseServiceAccountKey.json
```

## 🔌 API

**64 endpoint**, chia theo tiền tố:

| Tiền tố | Module |
| --- | --- |
| `/api/users` | Tài khoản, đăng nhập, vai trò |
| `/api/courses` | Khóa học |
| `/api/course-categories` | Danh mục khóa học |
| `/api/lessons` | Bài học, tiến độ |
| `/api/enrollments` | Đăng ký khóa học |
| `/api/quizzes` | Bài kiểm tra |
| `/api/questions` | Câu hỏi |
| `/api/quiz-results` | Kết quả & chấm điểm |
| `/api/reviews` | Đánh giá |
| `/api/bookmarks` | Bookmark |
| `/api/notifications` | Thông báo |
| `/api/mentor-requests` | Yêu cầu làm mentor |
| `/api/app-stats` | Thống kê |

Tài liệu đầy đủ (tham số, body, response) có tại **Swagger UI**: `/api-docs`.

## 🔒 Xác thực & phân quyền

**Cách xác thực:** gửi JWT qua header

```
Authorization: Bearer <token>
```

**Luồng đăng nhập:** client lấy **Firebase ID Token** → gửi `POST /api/users/login`
→ server xác thực với Firebase, tra role trong PostgreSQL, trả về **JWT** (hạn 7 ngày).
Các request sau dùng JWT này.

**Vai trò:**

| Vai trò | Quyền |
| --- | --- |
| `user` | Đọc dữ liệu công khai, đăng ký học, làm quiz, review, bookmark |
| `mentor` | Thêm: tạo/sửa khóa học, bài học, quiz của mình |
| `admin` | Toàn quyền: quản lý user, duyệt khóa học, duyệt mentor request |

**Cơ chế bảo vệ:**

- **Đối chiếu DB mỗi request** — role lấy từ PostgreSQL, không tin role trong token.
  Tài khoản bị khoá/xoá sẽ bị từ chối ngay, dù token còn hạn.
- **`resolveActorUid`** — uid lấy từ token. Chỉ admin được thao tác thay người khác,
  nên không thể giả mạo uid qua body.
- **Kiểm tra quyền sở hữu** — mentor chỉ sửa/xoá tài nguyên do mình tạo.
- **Giới hạn đầu vào** — body JSON tối đa 1 MB; tham số số lượng có ngưỡng chặn.

## 🧪 Kiểm thử

```bash
npm test            # 228 test đơn vị (mock DB), chạy bằng node --test
```

Kiểm thử trên **server thật** (cần server đang chạy + `PROBE_BASE`):

```bash
npm run api:read      # Đọc dữ liệu thật qua 32 endpoint
npm run api:coverage  # Phủ toàn bộ 64 route
npm run api:authz     # Kiểm tra phân quyền, token hết hạn, IDOR
npm run api:write     # E2E ghi dữ liệu đầy đủ vòng đời
npm run api:leftover  # Kiểm tra dữ liệu rác còn sót
```

> ⚠️ Các script `api:write`, `api:coverage` **ghi vào database thật** rồi tự dọn dẹp.
> Luôn chạy `npm run api:leftover` sau để chắc chắn không còn dữ liệu rác.

## ☁️ Triển khai

### Vercel (đang dùng)

Production: **https://online-learning-api.vercel.app**

```bash
vercel deploy --prod --scope <team>
```

Cấu hình trong `vercel.json`: build `src/app.js` bằng `@vercel/node`.
`src/index.js` tự bỏ qua `app.listen()` khi phát hiện biến `VERCEL`.

Biến môi trường cần set trên Vercel: `DATABASE_URL`, `JWT_SECRET`
(+ `FIREBASE_SERVICE_ACCOUNT_BASE64`, `OPENAI_API_KEY`, `YOUTUBE_API_KEY` nếu dùng tính năng tương ứng).

### Docker

```bash
npm run docker:up     # Khởi động API + PostgreSQL
npm run docker:down
npm run docker:logs
```

### Render

Có sẵn `render.yaml`. Nhớ nạp `FIREBASE_SERVICE_ACCOUNT_BASE64`.

## 🌿 Quy ước Git

| Nhánh | Mục đích |
| --- | --- |
| `develop` | Phát triển chính — nơi sửa và kiểm thử |
| `production` | Bản deploy lên Vercel |
| `main` | Bản phát hành (đồng bộ với `production`) |

**Luồng làm việc:** sửa trên `develop` → kiểm thử → merge `develop` → `production` → deploy.

**Commit message** (Conventional Commits):

```
<type>(<scope>): <mô tả ngắn>

- chi tiết 1
- chi tiết 2
```

`type`: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `chore`, `style`, `ci`.

---

## 👨‍💻 Tác giả

**Tranlong291003** — [github.com/Tranlong291003](https://github.com/Tranlong291003)

## 📄 License

[ISC](LICENSE) © 2026
