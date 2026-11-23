# Online Learning API

> RESTful API cho nền tảng học trực tuyến — Express 5 chạy trên Cloudflare Workers, dữ liệu lưu ở Cloudflare D1.

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)](https://expressjs.com)
[![Cloudflare](https://img.shields.io/badge/Cloudflare-Workers%20%2B%20D1-F38020?logo=cloudflare&logoColor=white)](https://www.cloudflare.com/developer-platform/)
[![Tests](https://img.shields.io/badge/tests-295%20passing-brightgreen)](#kiểm-thử)

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
   ┌─────────────────────────────┐
   │ Cloudflare Workers          │   Express 5, JWT, API routes
   │ src/worker.mjs → src/app.js │
   └──────────────┬──────────────┘
                  │ binding DB
                  ▼
   ┌─────────────────────────────┐
   │ Cloudflare D1 (SQLite)       │   users, courses, lessons, ...
   └─────────────────────────────┘
```

Luồng request: `routes → middleware (auth) → controllers → D1`.

Worker dùng binding `DB` và chuyển placeholder PostgreSQL sang SQLite tại
[`src/config/db.config.js`](src/config/db.config.js). Chạy API ngoài Cloudflare vẫn có thể dùng
PostgreSQL cục bộ qua `DATABASE_URL`.

## 🧰 Tech stack

| Thành phần | Công nghệ |
| --- | --- |
| Runtime | Cloudflare Workers (`nodejs_compat`) |
| Web framework | Express 5 |
| Database | Cloudflare D1 (SQLite) |
| Xác thực | API tự quản lý (email/password + bcrypt) → JWT ngắn hạn + refresh token |
| Upload file | Multer (avatar, thumbnail, PDF, slide) |
| Push notification | Firebase Admin SDK (FCM) — chỉ dùng để gửi thông báo, không dùng cho đăng nhập |
| AI | OpenAI (sinh câu hỏi quiz) |
| Tài liệu API | Swagger UI (`/api-docs`) |
| Kiểm thử | `node --test` |

## 📁 Cấu trúc thư mục

```
src/
├── app.js                 # Khai báo Express app, mount routes, middleware chung
├── index.js               # Điểm khởi động local/PostgreSQL
├── worker.mjs             # Điểm khởi động Cloudflare Workers
├── config/
│   ├── db.config.js       # D1 binding trên Worker, PostgreSQL khi chạy local
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

# 2. Sao chép .dev.vars.example thành .dev.vars và đặt JWT_SECRET cục bộ
# 3. Khởi động Worker + D1 local
npm run cf:dev

# Nếu cần chạy Express trực tiếp với PostgreSQL:
npm run dev
```

Server chạy tại `http://localhost:3000`.

**Production API:** [`https://lms.tranlong291003.workers.dev`](https://lms.tranlong291003.workers.dev). FE đặt URL này làm base URL.

| URL | Mô tả |
| --- | --- |
| `http://localhost:3000/health` | Health check |
| `http://localhost:3000/api-docs` | Swagger UI |

## 🔑 Biến môi trường

### Bắt buộc

| Biến | Mô tả |
| --- | --- |
| `JWT_SECRET` | Secret ký JWT, tối thiểu 32 ký tự; dùng `wrangler secret put JWT_SECRET` khi deploy |

### Tùy chọn

| Biến | Mô tả |
| --- | --- |
| `DATABASE_URL` | Chỉ cần khi chạy trực tiếp bằng PostgreSQL; Worker dùng binding D1 |
| `PORT` / `HOST` | Cổng và địa chỉ lắng nghe khi chạy Express trực tiếp |
| `CORS_ORIGIN` | Giới hạn origin được phép. Bỏ trống = cho phép tất cả |
| `FIREBASE_SERVICE_ACCOUNT_BASE64` | Nội dung file service account mã hoá base64. **Chỉ cần nếu dùng push notification** (FCM). Không liên quan tới đăng nhập |
| `OPENAI_API_KEY` | Sinh câu hỏi quiz bằng AI |
| `YOUTUBE_API_KEY` | Lấy thông tin video bài học |
| `DEV_API_KEY` + `DEV_API_KEY_UID` / `_ROLE` | Bypass JWT cho môi trường dev. **Tự động tắt khi `NODE_ENV=production`** |
| `AUTH_SKIP_DB_CHECK` | `true` để bỏ đối chiếu DB khi xác thực (chỉ dùng cho test) |

Worker giới hạn file upload ở **1.5 MiB** để phù hợp giới hạn kích thước một hàng D1. Không commit `.env` hoặc `.dev.vars` — đã có trong `.gitignore`. File `src/firebaseServiceAccountKey.json`
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

**Luồng đăng nhập:** client gửi `POST /api/auth/login` với `{ email, password }`
→ server trả **access token** (JWT, 15 phút) + **refresh token** (30 ngày, thu hồi được).
Các request sau dùng `Authorization: Bearer <access_token>`; khi hết hạn thì gọi
`POST /api/auth/refresh`. Chi tiết: `API_DOCUMENTATION.md` mục 2.

**Vai trò:**

| Vai trò | Quyền |
| --- | --- |
| `user` | Đọc dữ liệu công khai, đăng ký học, làm quiz, review, bookmark |
| `mentor` | Thêm: tạo/sửa khóa học, bài học, quiz của mình |
| `admin` | Toàn quyền: quản lý user, duyệt khóa học, duyệt mentor request |

**Cơ chế bảo vệ:**

- **Đối chiếu DB mỗi request** — role lấy từ D1, không tin role trong token.
  Tài khoản bị khoá/xoá sẽ bị từ chối ngay, dù token còn hạn.
- **`resolveActorUid`** — uid lấy từ token. Chỉ admin được thao tác thay người khác,
  nên không thể giả mạo uid qua body.
- **Kiểm tra quyền sở hữu** — mentor chỉ sửa/xoá tài nguyên do mình tạo.
- **Giới hạn đầu vào** — body JSON tối đa 1 MB; tham số số lượng có ngưỡng chặn.

## 🧪 Kiểm thử

```bash
npm test            # 295 test đơn vị (mock DB), chạy bằng node --test
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

Worker và binding D1 được khai báo trong [`wrangler.jsonc`](wrangler.jsonc). Sau khi đăng nhập Wrangler:

```bash
npm run cf:d1:apply
npm run cf:deploy
npm exec wrangler secret put JWT_SECRET
```

Đặt các secret tùy tính năng qua `wrangler secret put AI_API_KEY`,
`wrangler secret put YOUTUBE_API_KEY` và `wrangler secret put FIREBASE_SERVICE_ACCOUNT_JSON`.
Giữ nguyên `JWT_SECRET` hiện tại để token đang cấp còn hiệu lực; nếu phải tạo secret mới,
người dùng cần đăng nhập lại. Xem [`DEPLOYMENT.md`](DEPLOYMENT.md) để biết các cấu hình còn lại.

### Docker

```bash
npm run docker:up     # Khởi động API + PostgreSQL
npm run docker:down
npm run docker:logs
```

## 🌿 Quy ước Git

| Nhánh | Mục đích |
| --- | --- |
| `develop` | Phát triển chính — nơi sửa và kiểm thử |
| `production` | Cloudflare Worker `lms` |
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
