/**
 * Xác định "người thực hiện" (actor) cho các controller.
 *
 * Trước đây nhiều controller tin tưởng `uid` do client gửi trong body, nên bất kỳ
 * ai đã đăng nhập cũng có thể gửi uid của admin để vượt qua kiểm tra quyền.
 * Helper này lấy uid từ token (nguồn tin cậy) và chỉ chấp nhận uid client gửi kèm
 * khi trùng với token, hoặc khi người gọi là admin (admin thao tác hộ người khác).
 *
 * @returns {string|null} uid hợp lệ, hoặc null nếu đã gửi response lỗi.
 */
const resolveActorUid = (req, res, claimedUid) => {
  const actorUid = req.user && req.user.uid;

  if (!actorUid) {
    res.status(401).json({ error: "Không xác định được người dùng từ token" });
    return null;
  }

  if (claimedUid === undefined || claimedUid === null || claimedUid === "") {
    return String(actorUid);
  }

  if (String(claimedUid) !== String(actorUid)) {
    if (req.user.role !== "admin") {
      res.status(403).json({
        error: "Bạn không có quyền thao tác thay người dùng khác",
      });
      return null;
    }
    // Admin thao tác hộ người dùng khác
    return String(claimedUid);
  }

  return String(actorUid);
};

module.exports = { resolveActorUid };
