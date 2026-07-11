// =============================================================
// Test cho supabase.service - wrapper CRUD
// =============================================================
// Mock supabase client, verify wrapper gọi đúng chain
// =============================================================

jest.mock("../src/config/supabase.config", () => {
  // Supabase chainable: mỗi method trả về cùng builder
  // để track gọi đúng, dùng shared object
  const makeChain = () => {
    const chain = {};
    chain._calls = { eq: [], filter: [], order: [], limit: [], range: [] };
    chain.select = jest.fn(() => chain);
    chain.insert = jest.fn(() => chain);
    chain.update = jest.fn(() => chain);
    chain.delete = jest.fn(() => chain);
    chain.eq = jest.fn((col, val) => {
      chain._calls.eq.push([col, val]);
      return chain;
    });
    chain.filter = jest.fn((col, op, val) => {
      chain._calls.filter.push([col, op, val]);
      return chain;
    });
    chain.order = jest.fn((col, opts) => {
      chain._calls.order.push([col, opts]);
      return chain;
    });
    chain.limit = jest.fn((n) => {
      chain._calls.limit.push([n]);
      return chain;
    });
    chain.range = jest.fn((from, to) => {
      chain._calls.range.push([from, to]);
      return chain;
    });
    chain.single = jest.fn(() =>
      Promise.resolve({ data: { id: 1 }, error: null })
    );
    chain.maybeSingle = jest.fn(() =>
      Promise.resolve({ data: { id: 1 }, error: null })
    );
    chain.then = jest.fn((resolve) =>
      resolve({ data: [{ id: 1, name: "x" }], error: null })
    );
    return chain;
  };
  return {
    supabaseAdmin: {
      from: jest.fn(() => makeChain()),
      rpc: jest.fn(() => Promise.resolve({ data: [], error: null })),
    },
    createUserClient: jest.fn(() => ({
      from: jest.fn(() => makeChain()),
    })),
  };
});

const {
  supabaseAdmin,
  selectRows,
  insertRows,
  updateRows,
  deleteRows,
  callRpc,
} = require("../src/services/supabase.service");

// Helper: lấy chain mới nhất
const lastChain = () => {
  const calls = supabaseAdmin.from.mock.results;
  return calls[calls.length - 1].value;
};

describe("supabase.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("selectRows", () => {
    it("gọi from(table).select(columns) đúng", async () => {
      const { data, error } = await selectRows(
        supabaseAdmin,
        "users",
        "id, name"
      );
      expect(supabaseAdmin.from).toHaveBeenCalledWith("users");
      expect(data).toEqual([{ id: 1, name: "x" }]);
      expect(error).toBeNull();
    });

    it("truyền eq filter thành chain .eq()", async () => {
      await selectRows(supabaseAdmin, "users", "*", { eq: { uid: "abc" } });
      const c = lastChain();
      expect(c._calls.eq).toEqual([["uid", "abc"]]);
    });

    it("dùng single() khi options.single = true", async () => {
      await selectRows(supabaseAdmin, "users", "*", {
        eq: { uid: "abc" },
        single: true,
      });
      expect(lastChain().single).toHaveBeenCalled();
    });

    it("áp dụng order + limit", async () => {
      await selectRows(supabaseAdmin, "users", "*", {
        order: { col: "created_at", ascending: false },
        limit: 10,
      });
      const c = lastChain();
      expect(c._calls.order).toEqual([["created_at", { ascending: false }]]);
      expect(c._calls.limit).toEqual([[10]]);
    });

    it("hỗ trợ multiple eq filters", async () => {
      await selectRows(supabaseAdmin, "enrollments", "*", {
        eq: { user_uid: "u1", course_id: 5 },
      });
      const c = lastChain();
      expect(c._calls.eq).toEqual([
        ["user_uid", "u1"],
        ["course_id", 5],
      ]);
    });
  });

  describe("insertRows", () => {
    it("insert 1 row (object) thành array", async () => {
      const row = { name: "Alice", email: "a@b.c" };
      await insertRows(supabaseAdmin, "users", row);
      expect(lastChain().insert).toHaveBeenCalledWith([row]);
    });

    it("insert nhiều row (array) giữ nguyên", async () => {
      const rows = [{ name: "A" }, { name: "B" }];
      await insertRows(supabaseAdmin, "users", rows);
      expect(lastChain().insert).toHaveBeenCalledWith(rows);
    });
  });

  describe("updateRows", () => {
    it("update với patch và eq", async () => {
      await updateRows(
        supabaseAdmin,
        "users",
        { name: "Bob" },
        { uid: "abc" }
      );
      const c = lastChain();
      expect(c.update).toHaveBeenCalledWith({ name: "Bob" });
      expect(c._calls.eq).toEqual([["uid", "abc"]]);
    });
  });

  describe("deleteRows", () => {
    it("delete với eq", async () => {
      await deleteRows(supabaseAdmin, "users", { uid: "abc" });
      const c = lastChain();
      expect(c.delete).toHaveBeenCalled();
      expect(c._calls.eq).toEqual([["uid", "abc"]]);
    });
  });

  describe("callRpc", () => {
    it("gọi rpc(fnName, args)", async () => {
      await callRpc(supabaseAdmin, "get_stats", { user_id: 1 });
      expect(supabaseAdmin.rpc).toHaveBeenCalledWith("get_stats", {
        user_id: 1,
      });
    });
  });
});
