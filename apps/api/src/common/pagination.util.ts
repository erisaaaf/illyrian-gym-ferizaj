import { PaginatedResult } from "@illyrian/types";

export function paginate<T>(data: T[], total: number, page: number, pageSize: number): PaginatedResult<T> {
  return {
    data,
    meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
}

export function skipTake(page = 1, pageSize = 20) {
  return { skip: (page - 1) * pageSize, take: pageSize };
}
