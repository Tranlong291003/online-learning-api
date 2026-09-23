-- ============================================================
-- Migration 002: File upload lưu trong CSDL
-- ============================================================
-- Dùng cho DB ĐÃ TỒN TẠI. `database_postgres.sql` chỉ tạo được bảng khi chạy
-- from đầu; file này bù phần đó cho DB đang chạy production.
--
-- Idempotent: chạy lại nhiều lần không lỗi, không mất dữ liệu.
--
-- Chạy: npm run db:migrate:uploads
--
-- Bối cảnh: trước đây file upload ghi ra src/public/uploads/. Trên Vercel
-- (serverless) mã nguồn ở thư mục chỉ đọc nên mọi upload trả 500, và kể cả khi
-- ghi được thì đĩa cũng là tạm thời. Bảng này giữ nội dung file để API phục vụ
-- lại qua GET /uploads/*.
-- ============================================================

CREATE TABLE IF NOT EXISTS uploaded_files (
    file_id         BIGSERIAL       PRIMARY KEY,
    public_path     VARCHAR(255)    NOT NULL UNIQUE,
    mime_type       VARCHAR(120)    NOT NULL,
    size_bytes      INTEGER         NOT NULL,
    content         BYTEA           NOT NULL,
    original_name   VARCHAR(255)    NULL,
    owner_uid       VARCHAR(50)     NULL,
    created_at      TIMESTAMP       NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP       NULL
);

CREATE INDEX IF NOT EXISTS idx_uploaded_files_owner ON uploaded_files(owner_uid);
