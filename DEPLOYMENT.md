# Triển khai Cloudflare Workers + D1

## Cấu hình dự án

[`wrangler.jsonc`](wrangler.jsonc) khai báo Worker `lms`, D1 binding `DB` và giới hạn upload 1.5 MiB. Schema nằm trong [`cloudflare/d1-schema.sql`](cloudflare/d1-schema.sql). Worker production: [`https://lms.tranlong291003.workers.dev`](https://lms.tranlong291003.workers.dev). Đặt URL này làm `BASE_URL` trong FE.

## Đăng nhập và triển khai

Máy triển khai cần Node.js 22 trở lên và Wrangler 4:

```bash
npm ci
npm run cf:dev
npm run cf:deploy
```

Chạy `npx wrangler login` để liên kết CLI với tài khoản Cloudflare. D1 production `lms` đã có schema và dữ liệu; không chạy lại schema trên production. `cf:dev` chạy local Worker và D1 local; `cf:deploy` triển khai Worker.

## Secrets

Không đặt secrets trong `wrangler.jsonc`, `.env.example` hay Git. Đặt secret bằng Wrangler:

```bash
npm exec wrangler secret put JWT_SECRET
npm exec wrangler secret put AI_API_KEY
npm exec wrangler secret put YOUTUBE_API_KEY
npm exec wrangler secret put FIREBASE_SERVICE_ACCOUNT_JSON
```

`JWT_SECRET` phải giữ cùng giá trị với môi trường đang phát hành token. Nếu thay secret, access token hiện tại sẽ hết hiệu lực và người dùng cần đăng nhập lại. `AI_API_KEY`, `YOUTUBE_API_KEY`, Firebase và `CORS_ORIGIN` chỉ cần cấu hình nếu dùng các tính năng tương ứng.

## Kiểm tra sau deploy

```bash
npm test
npm exec wrangler deploy -- --dry-run
```

Production API: `https://lms.tranlong291003.workers.dev`. Các endpoint auth là `/api/auth/register`, `/api/auth/login`, `/api/auth/refresh`, `/api/auth/me` và `/api/auth/logout`. Không chạy các script `api:write`, `api:coverage` hoặc `api:sweep` trên production nếu chưa chuẩn bị dữ liệu kiểm thử và quy trình dọn dẹp.

Tài khoản được chuyển từ hệ thống cũ nhưng không có `password_hash` cần đặt mật khẩu mới qua luồng xác minh email trước khi dùng đăng nhập mật khẩu. Hiện luồng quên mật khẩu chưa có dịch vụ gửi email; không trả token đặt lại trong production.

## Upload file

Worker lưu file trong bảng `uploaded_files` của D1 để giữ URL hiện hữu. Mỗi file bị giới hạn 1.5 MiB nhằm chừa khoảng trống dưới giới hạn hàng D1 2 MiB. R2 chưa được bật cho account nên chưa dùng làm nơi lưu file.

## Auth và lưu trữ

Mật khẩu được hash bằng bcrypt. Access token là JWT HS256 sống 15 phút; refresh token ngẫu nhiên được lưu dưới dạng SHA-256 và đổi mới một lần mỗi lần refresh. `JWT_SECRET` đã được đặt trực tiếp trong Cloudflare Worker dưới dạng secret, không nằm trong repo.
