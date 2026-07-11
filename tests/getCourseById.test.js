// Test cho getCourseById (merge instructor + category + rating + duration)
jest.mock("../src/services/supabase.service", () => ({
  supabaseAdmin: {
    from: jest.fn(),
  },
  selectRows: jest.fn(),
  insertRows: jest.fn(),
  updateRows: jest.fn(),
  deleteRows: jest.fn(),
  callRpc: jest.fn(),
}));

const { supabaseAdmin } = require("../src/services/supabase.service");
const getCourseById = require("../src/controllers/courses/getCourseById");

const mockRes = () => {
  const r = {};
  r.status = jest.fn(() => r);
  r.json = jest.fn((x) => x);
  return r;
};

describe("getCourseById", () => {
  beforeEach(() => jest.clearAllMocks());

  it("merge day du cac field can thiet", async () => {
    // courses: selectRows -> single
    const { selectRows } = require("../src/services/supabase.service");
    selectRows.mockResolvedValueOnce({
      data: { course_id: 1, title: "React", instructor_uid: "u1", category_id: 10, price: 100, discount_price: 50, updated_at: "2024-01-01" },
      error: null,
    });

    // from chain: users -> category -> reviews -> enrollments -> lessons
    supabaseAdmin.from.mockImplementation((table) => {
      if (table === "users")
        return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { uid: "u1", name: "Nguyễn Văn A", avatar_url: "a.png", bio: "Mentor 5 nam kinh nghiem" }, error: null }) }) }) };
      if (table === "course_categories")
        return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { category_id: 10, name: "Lập trình" }, error: null }) }) }) };
      if (table === "course_reviews")
        return { select: () => ({ eq: () => Promise.resolve({ data: [{ rating: 5 }, { rating: 4 }, { rating: 3 }], error: null }) }) };
      if (table === "enrollments")
        return { select: () => ({ eq: () => Promise.resolve({ data: [{ user_uid: "x" }, { user_uid: "y" }], error: null }) }) };
      if (table === "lessons")
        return { select: () => ({ eq: () => Promise.resolve({ data: [
          { lesson_id: 1, updated_at: "2024-02-01", video_duration: "00:10:00" },
          { lesson_id: 2, updated_at: "2024-02-05", video_duration: "00:25:30" },
        ], error: null }) }) };
      return {};
    });

    const req = { params: { course_id: "1" } };
    const res = mockRes();
    await getCourseById(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const data = res.json.mock.calls[0][0].data;
    expect(data.title).toBe("React");
    expect(data.instructor_name).toBe("Nguyễn Văn A");
    expect(data.instructor_bio).toBe("Mentor 5 nam kinh nghiem");
    expect(data.category_name).toBe("Lập trình");
    expect(data.avg_rating).toBe(4);                  // (5+4+3)/3 = 4
    expect(data.review_count).toBe(3);
    expect(data.enrollment_count).toBe(2);
    expect(data.lesson_count).toBe(2);
    expect(data.total_video_duration).toBe("00:35:30");
    expect(data.last_lesson_update).toBe("2024-02-05");
    expect(data.last_update).toBe("2024-02-05");
    expect(data.discount_percent).toBe(50);
  });

  it("tra 404 khi khong co course", async () => {
    const { selectRows } = require("../src/services/supabase.service");
    selectRows.mockResolvedValueOnce({ data: null, error: null });
    const req = { params: { course_id: "999" } };
    const res = mockRes();
    await getCourseById(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json.mock.calls[0][0].error).toMatch(/Không tìm thấy/);
  });

  it("discount_percent = 0 khi khong co discount_price", async () => {
    const { selectRows } = require("../src/services/supabase.service");
    selectRows.mockResolvedValueOnce({
      data: { course_id: 1, title: "Free", instructor_uid: "u1", category_id: null, price: 0, discount_price: null, updated_at: "2024-01-01" },
      error: null,
    });
    supabaseAdmin.from.mockImplementation((table) => {
      if (table === "users") return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) };
      if (table === "course_reviews") return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) };
      if (table === "enrollments") return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) };
      if (table === "lessons") return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) };
      return {};
    });
    const req = { params: { course_id: "1" } };
    const res = mockRes();
    await getCourseById(req, res);
    const data = res.json.mock.calls[0][0].data;
    expect(data.discount_percent).toBe(0);
    expect(data.total_video_duration).toBe("00:00:00");
    expect(data.avg_rating).toBe(0);
  });
});
