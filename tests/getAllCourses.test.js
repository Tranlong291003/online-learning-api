// Test cho getAllCourses (dùng Jest mock, không goi Supabase that)
// Luu y: getAllCourses goi selectRows(...) de lay courses, va supabaseAdmin.from(...) de lay cac bang phu.
jest.mock("../src/services/supabase.service", () => {
  const supabaseAdmin = {
    from: jest.fn(),
  };
  return {
    supabaseAdmin,
    selectRows: jest.fn(),
    insertRows: jest.fn(),
    updateRows: jest.fn(),
    deleteRows: jest.fn(),
    callRpc: jest.fn(),
  };
});

const { selectRows, supabaseAdmin } = require("../src/services/supabase.service");
const getAllCourses = require("../src/controllers/courses/getAllCourses");

const mockRes = () => {
  const r = {};
  r.status = jest.fn(() => r);
  r.json = jest.fn((x) => x);
  return r;
};

describe("getAllCourses", () => {
  beforeEach(() => jest.clearAllMocks());

  it("tra 3 nhom pending/approved/rejected day du, co rating + enroll_count + total_duration", async () => {
    selectRows.mockResolvedValueOnce({
      data: [
        { course_id: 1, title: "React", instructor_uid: "u1", category_id: 10, price: 100, discount_price: 50, level: "beginner", status: "approved", updated_at: "2024-01-01" },
        { course_id: 2, title: "Vue", instructor_uid: "u2", category_id: 10, price: 200, discount_price: null, level: "intermediate", status: "pending", updated_at: "2024-01-02" },
        { course_id: 3, title: "Angular", instructor_uid: "u1", category_id: 20, price: 300, discount_price: 150, level: "advanced", status: "rejected", updated_at: "2024-01-03" },
      ],
      error: null,
    });
    supabaseAdmin.from.mockImplementation((table) => {
      if (table === "users") return { select: () => ({ in: () => Promise.resolve({ data: [
        { uid: "u1", name: "Nguyễn Văn A", avatar_url: "a.png" },
        { uid: "u2", name: "Trần Thị B", avatar_url: "b.png" },
      ], error: null }) }) };
      if (table === "course_categories") return { select: () => ({ in: () => Promise.resolve({ data: [
        { category_id: 10, name: "Lập trình" },
        { category_id: 20, name: "Ngoại ngữ" },
      ], error: null }) }) };
      if (table === "course_reviews") return { select: () => ({ in: () => Promise.resolve({ data: [
        { course_id: 1, rating: 5 }, { course_id: 1, rating: 4 },
        { course_id: 3, rating: 3 },
      ], error: null }) }) };
      if (table === "enrollments") return { select: () => ({ in: () => Promise.resolve({ data: [
        { course_id: 1 }, { course_id: 1 }, { course_id: 1 }, { course_id: 2 },
      ], error: null }) }) };
      if (table === "lessons") return { select: () => ({ in: () => Promise.resolve({ data: [
        { course_id: 1, video_duration: "00:10:00" },
        { course_id: 1, video_duration: "00:05:30" },
        { course_id: 2, video_duration: "01:00:00" },
      ], error: null }) }) };
      return { select: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) };
    });

    const req = { query: {} };
    const res = mockRes();
    await getAllCourses(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.total).toBe(3);
    expect(body.data.approved).toHaveLength(1);
    expect(body.data.pending).toHaveLength(1);
    expect(body.data.rejected).toHaveLength(1);
    const react = body.data.approved[0];
    expect(react.instructor_name).toBe("Nguyễn Văn A");
    expect(react.category_name).toBe("Lập trình");
    expect(react.rating).toBe(4.5);
    expect(react.review_count).toBe(2);
    expect(react.enroll_count).toBe(3);
    expect(react.lesson_count).toBe(2);
    expect(react.total_duration).toBe("00:15:30");
    expect(react.discount_percent).toBe(50);
  });

  it("filter theo status", async () => {
    selectRows.mockResolvedValueOnce({
      data: [
        { course_id: 1, status: "approved", instructor_uid: "u1", category_id: 10, price: 100, discount_price: null, title: "A", updated_at: "" },
        { course_id: 2, status: "pending", instructor_uid: "u1", category_id: 10, price: 100, discount_price: null, title: "B", updated_at: "" },
      ],
      error: null,
    });
    supabaseAdmin.from.mockImplementation(() => ({ select: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) }));

    const req = { query: { status: "approved" } };
    const res = mockRes();
    await getAllCourses(req, res);
    const body = res.json.mock.calls[0][0];
    expect(body.total).toBe(1);
    expect(body.data.approved).toHaveLength(1);
  });

  it("filter theo category", async () => {
    selectRows.mockResolvedValueOnce({
      data: [
        { course_id: 1, status: "approved", instructor_uid: "u1", category_id: 10, price: 100, discount_price: null, title: "A", updated_at: "" },
        { course_id: 2, status: "approved", instructor_uid: "u1", category_id: 20, price: 100, discount_price: null, title: "B", updated_at: "" },
      ],
      error: null,
    });
    supabaseAdmin.from.mockImplementation((table) => {
      if (table === "course_categories") return { select: () => ({ in: () => Promise.resolve({ data: [{ category_id: 20, name: "Ngoại ngữ" }], error: null }) }) };
      return { select: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) };
    });

    const req = { query: { category: "20" } };
    const res = mockRes();
    await getAllCourses(req, res);
    const body = res.json.mock.calls[0][0];
    expect(body.total).toBe(1);
    expect(body.data.approved[0].category_name).toBe("Ngoại ngữ");
  });

  it("search theo instructor_name co dau", async () => {
    selectRows.mockResolvedValueOnce({
      data: [
        { course_id: 1, status: "approved", instructor_uid: "u1", category_id: 10, price: 100, discount_price: null, title: "A", updated_at: "" },
        { course_id: 2, status: "pending", instructor_uid: "u2", category_id: 10, price: 100, discount_price: null, title: "B", updated_at: "" },
      ],
      error: null,
    });
    supabaseAdmin.from.mockImplementation((table) => {
      if (table === "users") return { select: () => ({ in: () => Promise.resolve({ data: [
        { uid: "u1", name: "Nguyễn Văn A", avatar_url: null },
        { uid: "u2", name: "Trần Thị B", avatar_url: null },
      ], error: null }) }) };
      return { select: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) };
    });

    const req = { query: { search: "Nguyễn" } };
    const res = mockRes();
    await getAllCourses(req, res);
    const body = res.json.mock.calls[0][0];
    // u1 la "Nguyễn Văn A" -> chi khoa hoc cua u1 (course 1)
    expect(body.total).toBe(1);
    expect(body.data.approved).toHaveLength(1);
  });

  it("tra ve total=0 khi khong co course", async () => {
    selectRows.mockResolvedValueOnce({ data: [], error: null });
    const req = { query: {} };
    const res = mockRes();
    await getAllCourses(req, res);
    const body = res.json.mock.calls[0][0];
    expect(body.total).toBe(0);
    expect(body.data).toEqual({ pending: [], approved: [], rejected: [] });
  });
});
