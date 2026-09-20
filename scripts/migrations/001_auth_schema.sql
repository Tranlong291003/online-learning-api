-- ============================================================
-- Migration 001: Xác thực (auth) + bảng phiên đăng nhập
-- ============================================================
-- Dùng cho DB ĐÃ TỒN TẠI. `database_postgres.sql` dùng CREATE TABLE IF NOT EXISTS
-- nên với bảng users đã có, câu đó là no-op và các cột mới KHÔNG được thêm vào.
-- File này bù đúng phần đó.
--
-- Idempotent: chạy lại nhiều lần không lỗi, không mất dữ liệu.
--
-- Chạy: npm run db:migrate:auth
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Kiểm tra dữ liệu TRƯỚC khi đổi gì
-- ------------------------------------------------------------
-- Chạy kiểm tra trước mọi thay đổi để thông báo lỗi rõ ràng kịp xuất hiện. Nếu
-- hạ chữ thường email trước rồi mới kiểm tra, câu UPDATE có thể vỡ vì ràng buộc
-- UNIQUE đang có, và ta nhận được lỗi khó hiểu thay vì chỉ đúng vấn đề.
--
-- Luồng đăng nhập tra theo LOWER(email). Nếu tồn tại cả 'A@x.com' và 'a@x.com'
-- thì không xác định được tài khoản nào, nên phải xử lý thủ công.
DO $$
DECLARE
  duplicate_emails TEXT;
BEGIN
  SELECT STRING_AGG(lower_email || ' (' || so_lan || ' dòng)', ', ')
  INTO duplicate_emails
  FROM (
    SELECT LOWER(TRIM(email)) AS lower_email, COUNT(*) AS so_lan
    FROM users
    WHERE email IS NOT NULL
    GROUP BY LOWER(TRIM(email))
    HAVING COUNT(*) > 1
  ) dup;

  IF duplicate_emails IS NOT NULL THEN
    RAISE EXCEPTION
      'Có email trùng nhau trong bảng users: %. Đăng nhập tra theo LOWER(email) nên không xác định được tài khoản. Xử lý thủ công (đổi/xoá bớt) rồi chạy lại migration.',
      duplicate_emails;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 2. users.id — khoá kỹ thuật dạng số
-- ------------------------------------------------------------
-- quiz_results.graded_by là INT và trỏ vào cột này. DB thật đã có cột `id`
-- (vì FK đang hoạt động) nên bước này thường là no-op; giữ lại để DB dựng mới
-- từ schema cũ vẫn chạy được.
ALTER TABLE users ADD COLUMN IF NOT EXISTS id SERIAL;

-- Đảm bảo id là duy nhất (FK trỏ tới cột này yêu cầu điều đó). Kiểm tra qua
-- pg_indexes — cách này nhận cả unique constraint lẫn unique index đang có.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'users'
      AND indexdef ILIKE '%UNIQUE%'
      AND indexdef ILIKE '%(id)%'
  ) THEN
    CREATE UNIQUE INDEX uq_users_id ON users(id);
  END IF;
END $$;

-- ------------------------------------------------------------
-- 3. users: cột phục vụ đăng nhập bằng mật khẩu
-- ------------------------------------------------------------
-- NULL với tài khoản cũ (tạo trước khi API tự quản lý mật khẩu). Những tài khoản
-- này KHÔNG đăng nhập được bằng mật khẩu cho tới khi đặt lại qua
-- /api/auth/forgot-password. Không đặt NOT NULL vì sẽ làm migration thất bại
-- trên DB đang có dữ liệu.
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

-- Chống dò mật khẩu.
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;

-- ------------------------------------------------------------
-- 4. users.email — chuẩn hoá chữ thường và bảo đảm duy nhất
-- ------------------------------------------------------------
-- Đã kiểm tra trùng ở bước 1 nên UPDATE này an toàn kể cả khi đang có UNIQUE.
UPDATE users
SET email = LOWER(TRIM(email))
WHERE email IS NOT NULL AND email <> LOWER(TRIM(email));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'users'
      AND indexdef ILIKE '%UNIQUE%'
      AND indexdef ILIKE '%(email)%'
  ) THEN
    CREATE UNIQUE INDEX uq_users_email ON users(email);
  END IF;
END $$;

-- ------------------------------------------------------------
-- 5. refresh_tokens — phiên đăng nhập dài hạn, thu hồi được
-- ------------------------------------------------------------
-- Chỉ lưu SHA-256 của token, không lưu token gốc: DB bị lộ cũng không dùng lại
-- được giá trị trong bảng để lấy access token mới.
CREATE TABLE IF NOT EXISTS refresh_tokens (
    token_id        UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    uid             VARCHAR(50)     NOT NULL,
    token_hash      CHAR(64)        NOT NULL UNIQUE,
    -- Cả họ token (mọi lần rotate của cùng một phiên) chia sẻ family_id. Phát
    -- hiện token cũ bị dùng lại thì xoá theo family_id để vô hiệu hoá cả phiên.
    family_id       UUID            NOT NULL,
    expires_at      TIMESTAMP       NOT NULL,
    revoked_at      TIMESTAMP       NULL,
    replaced_by     UUID            NULL,
    user_agent      VARCHAR(255)    NULL,
    created_at      TIMESTAMP       NOT NULL DEFAULT NOW(),
    FOREIGN KEY (uid) REFERENCES users(uid) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_uid ON refresh_tokens(uid);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family ON refresh_tokens(family_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);

-- ------------------------------------------------------------
-- 6. password_resets — yêu cầu đặt lại mật khẩu
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS password_resets (
    reset_id        UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    uid             VARCHAR(50)     NOT NULL,
    token_hash      CHAR(64)        NOT NULL UNIQUE,
    expires_at      TIMESTAMP       NOT NULL,
    used_at         TIMESTAMP       NULL,
    created_at      TIMESTAMP       NOT NULL DEFAULT now(),
    FOREIGN KEY (uid) REFERENCES users(uid) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_password_resets_uid ON password_resets(uid);

COMMIT;
