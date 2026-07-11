// =============================================================
// Supabase service wrapper
// =============================================================
// Chuẩn hoá các thao tác CRUD lên Supabase Postgres.
// Mục tiêu:
//   - Giảm boilerplate trong controllers
//   - Xử lý lỗi nhất quán (luôn trả về { data, error })
//   - Dễ test: nhận client qua DI, có thể mock
// =============================================================
const { supabaseAdmin, createUserClient } = require("../config/supabase.config");

/**
 * Chọn client phù hợp cho request.
 * - Nếu req có supabaseUser (do authMiddleware set) -> dùng user-scoped client (RLS)
 * - Nếu không -> dùng supabaseAdmin (bypass RLS, dùng cho login/register/admin)
 */
function pickClient(req) {
  if (req && req.supabaseUser) {
    return createUserClient(req.supabaseUser.accessToken);
  }
  return supabaseAdmin;
}

/**
 * Helper: chuyển lỗi Supabase thành Error có message thân thiện.
 * Supabase trả về { data, error } trong đó error.message là mã kỹ thuật.
 */
function wrapError(operation, table, error) {
  if (!error) return null;
  const e = new Error(
    `[supabase] ${operation} ${table} failed: ${error.message}`
  );
  e.code = error.code;
  e.details = error.details;
  e.hint = error.hint;
  e.original = error;
  return e;
}

/**
 * SELECT rows from a table.
 * @param {object} client - supabase client (admin hoặc user-scoped)
 * @param {string} table - table name
 * @param {string} columns - default '*'
 * @param {object} options - { filter: {col, op, val}, eq: {col, val}, order: {col, ascending}, limit, single }
 * @returns {Promise<{data, error}>}
 */
async function selectRows(client, table, columns = "*", options = {}) {
  let q = client.from(table).select(columns);
  if (options.eq) {
    for (const [col, val] of Object.entries(options.eq)) {
      q = q.eq(col, val);
    }
  }
  if (options.filter) {
    for (const f of options.filter) {
      q = q.filter(f.col, f.op, f.val);
    }
  }
  if (options.order) {
    q = q.order(options.order.col, {
      ascending: options.order.ascending !== false,
    });
  }
  if (options.limit) {
    q = q.limit(options.limit);
  }
  if (options.range) {
    q = q.range(options.range.from, options.range.to);
  }
  const { data, error } = options.single
    ? await q.single()
    : options.maybeSingle
    ? await q.maybeSingle()
    : await q;
  return { data, error: wrapError("SELECT", table, error) };
}

/**
 * INSERT one or many rows.
 */
async function insertRows(client, table, rows, options = {}) {
  const payload = Array.isArray(rows) ? rows : [rows];
  const { data, error } = await client
    .from(table)
    .insert(payload)
    .select(options.returning || "*");
  return { data, error: wrapError("INSERT", table, error) };
}

/**
 * UPDATE rows matching eq filter.
 */
async function updateRows(client, table, patch, eq, options = {}) {
  let q = client.from(table).update(patch);
  for (const [col, val] of Object.entries(eq)) {
    q = q.eq(col, val);
  }
  const { data, error } = await q.select(options.returning || "*");
  return { data, error: wrapError("UPDATE", table, error) };
}

/**
 * DELETE rows matching eq filter.
 */
async function deleteRows(client, table, eq) {
  let q = client.from(table).delete();
  for (const [col, val] of Object.entries(eq)) {
    q = q.eq(col, val);
  }
  const { data, error } = await q;
  return { data, error: wrapError("DELETE", table, error) };
}

/**
 * RPC: gọi Postgres function (dùng cho advanced queries / aggregations).
 */
async function callRpc(client, fnName, args) {
  const { data, error } = await client.rpc(fnName, args);
  return { data, error: wrapError("RPC", fnName, error) };
}

module.exports = {
  pickClient,
  selectRows,
  insertRows,
  updateRows,
  deleteRows,
  callRpc,
  // Re-export admin client để controller có thể dùng trực tiếp khi cần
  supabaseAdmin,
  createUserClient,
};
