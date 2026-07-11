// Test cho enrollCourse controller (Supabase refactored)
jest.mock("../src/services/supabase.service", () => ({
  supabaseAdmin: {},
  selectRows: jest.fn(),
  insertRows: jest.fn(),
}));

const { selectRows, insertRows } = require("../src/services/supabase.service");
const enrollCourse = require("../src/controllers/enrollments/enrollCourse");

const mockRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

const authedReq = (overrides = {}) => ({
  supabaseUser: { authUser: { id: "u1" } },
  body: { course_id: 1 },
  ...overrides,
});

describe("enrollCourse controller (Supabase)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("401 khi chưa đăng nhập", async () => {
    const res = mockRes();
    await enrollCourse({ body: { course_id: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("400 khi thiếu course_id", async () => {
    const res = mockRes();
    await enrollCourse(authedReq({ body: {} }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("400 khi course_id không phải số", async () => {
    const res = mockRes();
    await enrollCourse(authedReq({ body: { course_id: "abc" } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("404 khi course không tồn tại", async () => {
    selectRows.mockResolvedValueOnce({ data: null, error: null });
    const res = mockRes();
    await enrollCourse(authedReq(), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("400 khi course chưa được approved", async () => {
    selectRows.mockResolvedValueOnce({ data: { course_id: 1, status: "pending", title: "x" }, error: null });
    const res = mockRes();
    await enrollCourse(authedReq(), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("409 khi insert trả UNIQUE violation (23505)", async () => {
    selectRows.mockResolvedValueOnce({ data: { course_id: 1, status: "approved", title: "x" }, error: null });
    insertRows.mockResolvedValueOnce({ data: null, error: { code: "23505", message: "dup" } });
    const res = mockRes();
    await enrollCourse(authedReq(), res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it("201 happy path", async () => {
    selectRows.mockResolvedValueOnce({ data: { course_id: 1, status: "approved", title: "x" }, error: null });
    insertRows.mockResolvedValueOnce({ data: [{ enrollment_id: 10, user_uid: "u1", course_id: 1 }], error: null });

    const res = mockRes();
    await enrollCourse(authedReq(), res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Đăng ký khóa học thành công",
        data: expect.objectContaining({ enrollment_id: 10 }),
      })
    );
  });

  it("500 khi selectRows throws", async () => {
    selectRows.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    const res = mockRes();
    await enrollCourse(authedReq(), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
