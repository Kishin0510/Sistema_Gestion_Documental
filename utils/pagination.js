// ── Helper de paginación ──────────────────────────
// Uso típico en una ruta:
//
//   const { page, pageSize, offset } = parsePagination(req.query)
//   const { rows } = await db.query('SELECT * FROM x LIMIT $1 OFFSET $2', [pageSize, offset])
//   const { rows: [{ count }] } = await db.query('SELECT COUNT(*) FROM x')
//   res.render('Vista', { items: rows, pagination: buildPageInfo(page, pageSize, count) })
//
// En la vista:
//   <%- include('partials/pagination', { pagination }) %>

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE     = 100

function parsePagination(query, defaultPageSize = DEFAULT_PAGE_SIZE) {
  let page     = parseInt(query.page, 10)
  let pageSize = parseInt(query.pageSize, 10)

  if (!Number.isInteger(page) || page < 1) page = 1
  if (!Number.isInteger(pageSize) || pageSize < 1) pageSize = defaultPageSize
  if (pageSize > MAX_PAGE_SIZE) pageSize = MAX_PAGE_SIZE

  const offset = (page - 1) * pageSize

  return { page, pageSize, offset }
}

function buildPageInfo(page, pageSize, totalCount) {
  const total      = Number(totalCount) || 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const clampedPage = Math.min(page, totalPages)

  return {
    page: clampedPage,
    pageSize,
    total,
    totalPages,
    hasPrev: clampedPage > 1,
    hasNext: clampedPage < totalPages,
    from: total === 0 ? 0 : (clampedPage - 1) * pageSize + 1,
    to:   Math.min(clampedPage * pageSize, total),
  }
}

module.exports = { parsePagination, buildPageInfo, DEFAULT_PAGE_SIZE }