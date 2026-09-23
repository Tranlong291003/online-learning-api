/**
 * Lưu file upload trong PostgreSQL thay vì ghi ra đĩa.
 *
 * Vấn đề: code cũ dùng `multer.diskStorage` để ghi vào `src/public/uploads/`.
 * Trên Vercel (và mọi nền tảng serverless) mã nguồn được triển khai ở thư mục
 * CHỈ ĐỌC, nên mọi lần upload đều thất bại. Triệu chứng đã quan sát trên
 * production: `POST /api/courses/create` kèm thumbnail trả 500
 * "Internal server error", trong khi cùng request đó chạy local trả 201.
 *
 * Ngay cả khi ghi được ra đĩa thì cũng vô nghĩa: filesystem của serverless là
 * tạm thời, file sẽ mất khi function tái khởi động.
 *
 * Cách làm ở đây: giữ nội dung file trong bảng `uploaded_files` (bytea) và
 * phục vụ lại qua `GET /uploads/*`. Không cần thêm dịch vụ ngoài, không cần
 * thêm credential, và file tồn tại lâu dài vì CSDL là nguồn chân lý duy nhất.
 *
 * Đổi lại, file nằm chung CSDL nên bị giới hạn kích thước (xem MAX_UPLOAD_MB).
 * Nếu sau này lượng file lớn, chỗ cần thay chỉ là `putFile`/`readFile` — các
 * controller không phải sửa vì chúng chỉ nhận `file.publicPath`.
 */
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const { pool } = require("../config/db.config");

/** Tiền tố công khai của mọi file upload. */
const PUBLIC_PREFIX = "/uploads/";

/**
 * Giới hạn kích thước file.
 *
 * Vercel serverless chỉ nhận request body tối đa ~4.5MB, nên để mặc định 4MB
 * thì người dùng nhận 413 rõ ràng từ API thay vì lỗi khó hiểu từ nền tảng.
 * Đặt MAX_UPLOAD_MB cao hơn khi triển khai trên nền tảng không giới hạn
 * (Docker, Render, VPS).
 */
const MAX_UPLOAD_MB = Math.max(1, Number(process.env.MAX_UPLOAD_MB) || 4);
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

/**
 * Thư mục công khai theo tên field của form.
 *
 * Giữ đúng đường dẫn cũ (`/uploads/courses/...`) để các URL đã lưu trong CSDL
 * và trong app đang chạy không bị đổi.
 */
const FIELD_DIRS = {
  icon: "categories",
  thumbnail: "courses",
  pdf: "lessons/pdf",
  slide: "lessons/slides",
  avatar: "avatars",
  image: "mentor_requests",
};

/** Lỗi do client gửi sai (file bị từ chối, quá lớn...) — luôn trả 4xx. */
class UploadRejectedError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "UploadRejectedError";
    this.status = status;
  }
}

/**
 * Phần mở rộng chỉ nhận chữ thường, ngắn và an toàn.
 * Tên file do server sinh nên không thể chứa `../` hay ký tự lạ.
 */
function safeExtension(originalName) {
  const ext = path.extname(String(originalName || "")).toLowerCase();
  return /^\.[a-z0-9]{1,10}$/.test(ext) ? ext : "";
}

/** Tên file ngẫu nhiên, không đoán được, không trùng nhau. */
function makeStoredName(originalName) {
  const unique = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
  return `${unique}${safeExtension(originalName)}`;
}

/**
 * Kiểm tra "chữ ký" (magic bytes) của file ảnh.
 *
 * Chỉ kiểm tra theo đuôi file là chưa đủ: một file văn bản đổi tên thành .png
 * vẫn đi qua `fileFilter` cũ và được phục vụ lại như một ảnh. Ở đây chặn thêm
 * ở tầng nội dung.
 */
function looksLikeImage(buffer, ext) {
  if (!buffer || buffer.length < 4) return false;
  const b = buffer;
  if (ext === ".png") {
    return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  }
  if (ext === ".jpg" || ext === ".jpeg") {
    return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  }
  return false;
}

/**
 * Kiểm tra "chữ ký" (magic bytes) của tài liệu: PDF, PPT, PPTX.
 *
 * Cùng lý do như với ảnh — đuôi file do client đặt nên không đáng tin. Một file
 * thực thi đổi tên thành `.pdf` sẽ đi qua nếu chỉ kiểm tra đuôi.
 */
function looksLikeDocument(buffer, ext) {
  if (!buffer || buffer.length < 8) return false;
  const b = buffer;
  // "%PDF"
  if (ext === ".pdf") {
    return b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46;
  }
  // .pptx là file ZIP
  if (ext === ".pptx") {
    return b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05 || b[2] === 0x07);
  }
  // .ppt là định dạng OLE2 (compound file)
  if (ext === ".ppt") {
    return b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0;
  }
  return false;
}

/** Thư mục chỉ chứa ảnh. */
const IMAGE_DIRS = new Set(["categories", "courses", "avatars", "mentor_requests"]);
/** Thư mục chỉ chứa tài liệu. */
const DOCUMENT_DIRS = new Set(["lessons/pdf", "lessons/slides"]);

/** Kiểm tra nội dung có khớp với thư mục đích hay không. */
function contentMatchesTarget(buffer, ext, dir) {
  if (IMAGE_DIRS.has(dir)) return looksLikeImage(buffer, ext);
  if (DOCUMENT_DIRS.has(dir)) return looksLikeDocument(buffer, ext);
  return true;
}

/** Câu thông báo lỗi theo thư mục đích. */
function rejectMessage(dir) {
  if (IMAGE_DIRS.has(dir)) return "File không phải ảnh JPEG hoặc PNG hợp lệ";
  return "File không đúng định dạng PDF, PPT hoặc PPTX";
}

/**
 * Lọc file theo ĐUÔI file.
 *
 * Chưa có buffer ở bước này (multer gọi fileFilter trước khi đọc xong nội dung),
 * nên phần kiểm tra chữ ký được làm trong `persistFiles`.
 */
function makeFileFilter({ extensions, message }) {
  return (req, file, cb) => {
    if (extensions.test(file.originalname)) return cb(null, true);
    return cb(new UploadRejectedError(message));
  };
}

/**
 * Ghi nội dung file vào CSDL.
 *
 * `ON CONFLICT` để lần upload lại cùng đường dẫn (không xảy ra với tên ngẫu
 * nhiên, nhưng vẫn an toàn) ghi đè thay vì lỗi.
 */
async function putFile({ publicPath, buffer, mimeType, originalName, ownerUid }) {
  await pool.query(
    `INSERT INTO uploaded_files
       (public_path, mime_type, size_bytes, content, original_name, owner_uid)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (public_path) DO UPDATE
       SET content       = EXCLUDED.content,
           mime_type     = EXCLUDED.mime_type,
           size_bytes    = EXCLUDED.size_bytes,
           original_name = EXCLUDED.original_name,
           owner_uid     = EXCLUDED.owner_uid,
           updated_at    = NOW()`,
    [
      publicPath,
      mimeType || "application/octet-stream",
      buffer.length,
      buffer,
      originalName || null,
      ownerUid || null,
    ]
  );
  return publicPath;
}

/**
 * Xoá các file upload theo danh sách đường dẫn công khai.
 *
 * Gọi khi xoá tài nguyên sở hữu file (danh mục, khoá học, bài học, người dùng).
 * Nếu bỏ bước này, mỗi lần xoá tài nguyên sẽ để lại file mồ côi trong
 * uploaded_files — CSDL phình dần mà không ai dọn.
 *
 * Bỏ qua giá trị rỗng và nuốt lỗi có chủ đích: đây là bước dọn dẹp, không được
 * làm hỏng thao tác xoá chính (bản ghi đã bị xoá trước đó rồi).
 *
 * @param {(string|null|undefined)[]} publicPaths
 */
async function deleteFiles(publicPaths) {
  const paths = [...new Set(publicPaths.filter(Boolean))];
  if (paths.length === 0) return 0;

  try {
    const result = await pool.query(
      "DELETE FROM uploaded_files WHERE public_path = ANY($1::text[])",
      [paths]
    );
    return result.rowCount;
  } catch (err) {
    console.warn("Không xoá được file upload:", paths.join(", "), err.message);
    return 0;
  }
}

/** Đọc file theo đường dẫn công khai. Trả về null nếu không có. */
async function readFile(publicPath) {
  const result = await pool.query(
    "SELECT mime_type, content, size_bytes FROM uploaded_files WHERE public_path = $1",
    [publicPath]
  );
  return result.rows[0] || null;
}

/**
 * Middleware: lưu mọi file multer đã nhận vào CSDL rồi gắn `publicPath`.
 *
 * Đặt ngay sau middleware multer trong mỗi route. Vì đây là thao tác bất đồng
 * bộ, lỗi phải được chuyển tiếp qua `next(err)` để rơi vào error handler của
 * app (nơi biến lỗi upload thành 4xx) thay vì treo request.
 */
function persistFiles() {
  return async (req, res, next) => {
    try {
      const files = [];
      if (req.file) files.push(req.file);
      if (req.files) {
        if (Array.isArray(req.files)) files.push(...req.files);
        else for (const group of Object.values(req.files)) files.push(...(group || []));
      }

      const ownerUid = req.user ? req.user.uid : null;

      for (const file of files) {
        const dir = FIELD_DIRS[file.fieldname] || "misc";
        const ext = safeExtension(file.originalname);

        // Kiểm tra nội dung khớp với thư mục đích (ảnh phải là ảnh, tài liệu
        // phải là PDF/PPT/PPTX). Đuôi file do client đặt nên không đáng tin.
        if (!contentMatchesTarget(file.buffer, ext, dir)) {
          throw new UploadRejectedError(rejectMessage(dir));
        }

        const publicPath = `${PUBLIC_PREFIX}${dir}/${makeStoredName(file.originalname)}`;
        await putFile({
          publicPath,
          buffer: file.buffer,
          mimeType: file.mimetype,
          originalName: file.originalname,
          ownerUid,
        });

        // Controller đọc `publicPath`; `filename` giữ lại cho code cũ.
        file.publicPath = publicPath;
        file.filename = path.basename(publicPath);
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Tạo bộ middleware upload cho một loại file.
 *
 * Trả về mảng `[multer, persistFiles]` nên dùng được nguyên chỗ với cú pháp
 * router cũ: `router.post("/create", upload.single("thumbnail"), controller)`.
 */
function createUploader({ allowedExtensions, message }) {
  const multerInstance = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_UPLOAD_BYTES },
    fileFilter: makeFileFilter({ extensions: allowedExtensions, message }),
  });

  return {
    single: (fieldName) => [multerInstance.single(fieldName), persistFiles()],
    fields: (defs) => [multerInstance.fields(defs), persistFiles()],
    any: () => [multerInstance.any(), persistFiles()],
  };
}

/**
 * Loại MIME an toàn để phục vụ lại, suy ra từ ĐUÔI FILE chứ không tin
 * `Content-Type` do client gửi lên.
 *
 * Nếu tin client, kẻ tấn công có thể upload nội dung HTML kèm
 * `Content-Type: text/html` rồi dụ người khác mở link `/uploads/...` — trình
 * duyệt sẽ chạy script ngay trên origin của API.
 */
const SAFE_MIME_BY_EXT = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".pdf": "application/pdf",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

function safeMimeType(publicPath, fallback) {
  const ext = path.extname(String(publicPath || "")).toLowerCase();
  return SAFE_MIME_BY_EXT[ext] || fallback || "application/octet-stream";
}

module.exports = {
  PUBLIC_PREFIX,
  MAX_UPLOAD_MB,
  MAX_UPLOAD_BYTES,
  UploadRejectedError,
  createUploader,
  persistFiles,
  putFile,
  deleteFiles,
  readFile,
  safeMimeType,
  looksLikeImage,
};
