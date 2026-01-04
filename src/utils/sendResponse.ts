import { Response } from 'express';
import { serializeBigInt } from './serialize';

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
    responseData.meta = serializeBigInt(data.meta);
  }

  if (data.data !== undefined && data.data !== null) {
    responseData.data = serializeBigInt(data.data);
  }

  res.status(data.statusCode).json(responseData);
};

export default sendResponse;
export type { IResponse };
