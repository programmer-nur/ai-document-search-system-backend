type PaginationOptions = {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
};

type PaginationResult<T> = {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
};

/**
 * Calculate pagination metadata
 */
export const calculatePagination = (
  total: number,
  page: number,
  limit: number
): PaginationResult<never>['meta'] => {
  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage,
    hasPrevPage,
  };
};

/**
 * Get pagination options from query parameters
 */
export const getPaginationOptions = (query: {
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}): PaginationOptions => {
  const page = query.page ? parseInt(query.page, 10) : 1;
  const limit = query.limit ? parseInt(query.limit, 10) : 10;
  const sortBy = query.sortBy || 'createdAt';
  const sortOrder = query.sortOrder || 'desc';

  return {
    page: Math.max(1, page),
    limit: Math.max(1, Math.min(100, limit)), // Limit between 1 and 100
    sortBy,
    sortOrder,
  };
};

export type { PaginationOptions, PaginationResult };
