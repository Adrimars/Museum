export interface ApiResponse<T> {
  statusCode: number;
  data: T;
  timestamp: string;
}

export interface ApiError {
  statusCode: number;
  message: string;
  errorCode: string;
  requestId: string;
  timestamp: string;
  path: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface CursorPaginatedResponse<T> {
  data: T[];
  cursor: string | null;
  hasMore: boolean;
}
