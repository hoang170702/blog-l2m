import { ArgumentsHost, Catch, HttpStatus } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '../generated/prisma/client.js';

const STATUS_BY_CODE: Record<string, HttpStatus> = {
  P2002: HttpStatus.CONFLICT,
  P2025: HttpStatus.NOT_FOUND,
};

/** Maps known Prisma errors (unique violation, record not found) to HTTP errors. */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter extends BaseExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const status = STATUS_BY_CODE[exception.code];
    if (!status) {
      return super.catch(exception, host);
    }
    const response = host.switchToHttp().getResponse();
    const message =
      status === HttpStatus.CONFLICT
        ? 'Resource already exists'
        : 'Resource not found';
    response.status(status).json({
      statusCode: status,
      message,
      error: HttpStatus[status],
    });
  }
}
