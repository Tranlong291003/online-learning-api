// Test cho getAllUsers controller (Supabase refactored)
jest.mock("../src/services/supabase.service", () => {
  const makeChain = () => {
    const c = {};
    c.select = jest.fn(() => c);
    c.eq = jest.fn(() => c);
    c.or = jest.fn(() => c);
    c.order = jest.fn(() => c);
    return c;
  };
  return {
    supabaseAdmin: { from: jest.fn(() => makeChain()) },
    __makeChain: makeChain,
  };
});

const { supabaseAdmin, __makeChain } = require("../src/services/supabase.service");
const getAllUsers = require("../src/controllers/users/getAllUsers");

const mockRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

describe("getAllUsers controller (Supabase)", () => {
  let chain;
  beforeEach(() => {
    jest.clearAllMocks();
    chain = __makeChain();
    supabaseAdmin.from.mockReturnValue(chain);
  });

  it("trả về 200 + users khi query thành công", async () => {
    const users = [
      { id: 1, uid: "u1", name: "Alice", email: "a@b.c", role: "user" },
      { id: 2, uid: "u2", name: "Bob", email: "b@c.d", role: "mentor" },
    ];
    chain.order.mockImplementation(() => chain);
    chain.then = (resolve) => resolve({ data: users, error: null });

    const res = mockRes();
    await getAllUsers({ query: {} }, res);

    expect(supabaseAdmin.from).toHaveBeenCalledWith("users");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Danh sách người dùng",
      users,
    });
  });

  it("trả về 500 khi query lỗi", async () => {
    chain.order.mockImplementation(() => chain);
    chain.then = (resolve) => resolve({ data: null, error: { message: "DB connection failed" } });

    const res = mockRes();
    await getAllUsers({ query: {} }, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining("DB connection failed") })
    );
  });

  it("trả về users: [] khi data null", async () => {
    chain.order.mockImplementation(() => chain);
    chain.then = (resolve) => resolve({ data: null, error: null });

    const res = mockRes();
    await getAllUsers({ query: {} }, res);

    expect(res.json).toHaveBeenCalledWith({
      message: "Danh sách người dùng",
      users: [],
    });
  });

  it("áp dụng filter role khi có query role (smoke test)", async () => {
    chain.order.mockImplementation(() => chain);
    chain.then = (resolve) => resolve({ data: [{ id: 1, role: "mentor" }], error: null });
    const res = mockRes();
    await getAllUsers({ query: { role: "mentor" } }, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("không throw khi không có query", async () => {
    chain.order.mockImplementation(() => chain);
    chain.then = (resolve) => resolve({ data: [], error: null });
    const res = mockRes();
    await getAllUsers({ query: {} }, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("trả về 200 khi có search", async () => {
    chain.order.mockImplementation(() => chain);
    chain.then = (resolve) => resolve({ data: [], error: null });
    const res = mockRes();
    await getAllUsers({ query: { search: "Alice" } }, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
