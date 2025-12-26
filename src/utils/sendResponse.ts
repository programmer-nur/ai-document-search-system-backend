import { Response } from 'express';

type IResponse<T> = {
  statusCode: number;
  success: boolean;
  message: string;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages?: number;
    hasNextPage?: boolean;
    hasPrevPage?: boolean;
  };
  data?: T | null;
};

const sendResponse = <T>(res: Response, data: IResponse<T>): void => {
  const responseData: Record<string, unknown> = {
    success: data.success,
    statusCode: data.statusCode,
    message: data.message,
  };

  if (data.meta) {
    responseData.meta = data.meta;
  }

  if (data.data !== undefined && data.data !== null) {
    responseData.data = data.data;
  }

  res.status(data.statusCode).json(responseData);
};

export default sendResponse;
export type { IResponse };

