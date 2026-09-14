/**
 * Consistent paging for list endpoints.
 *
 * Several admin and account screens fetched an entire collection — every
 * booking ever made, every withdrawal, every review — and returned the whole
 * array. That is survivable while a platform is small and is the first thing to
 * fall over when it is not.
 *
 * These endpoints keep returning a plain array so nothing calling them has to
 * change; they simply stop being able to return an unbounded one. A caller that
 * wants more asks for it by page.
 */

/** What a list returns when the caller does not say. */
const DEFAULT_LIMIT = 200;

/** The most any caller may take at once, however they ask. */
const MAX_LIMIT = 1000;

/**
 * Reads page and limit from a request, clamped.
 *
 * Anything unparseable falls back to the default rather than to "everything",
 * because a typo in a query string should not become a full table scan.
 */
const pageParams = (req, { defaultLimit = DEFAULT_LIMIT, maxLimit = MAX_LIMIT } = {}) => {
    const rawLimit = Number(req?.query?.limit);
    const rawPage = Number(req?.query?.page);

    const limit = Number.isFinite(rawLimit) && rawLimit > 0
        ? Math.min(Math.floor(rawLimit), maxLimit)
        : defaultLimit;
    const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;

    return { page, limit, skip: (page - 1) * limit };
};

/** Applies those to a Mongoose query. */
const paginate = (query, { page, limit, skip } = {}) =>
    query.skip(skip || 0).limit(limit || DEFAULT_LIMIT);

module.exports = { DEFAULT_LIMIT, MAX_LIMIT, pageParams, paginate };
