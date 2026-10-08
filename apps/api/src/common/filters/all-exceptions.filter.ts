import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import { Response } from "express";
import { ApiErrorResponse } from "@illyrian/types";
import { StructuredLogger } from "../logger/structured-logger.service";
import { RequestWithId } from "../middleware/request-id.middleware";

/**
 * Every error response, expected or not, is shaped as ApiErrorResponse.
 * Unknown/unexpected errors are logged with full detail server-side but
 * never leak a stack trace or internal message to the client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new StructuredLogger("ExceptionFilter");

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<RequestWithId>();
    const requestId = req.requestId ?? "unknown";

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "Internal server error";
    let errors: Record<string, string[]> | undefined;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === "string") {
        message = body;
      } else if (typeof body === "object" && body !== null) {
        const b = body as Record<string, unknown>;
        message = typeof b.message === "string" ? b.message : exception.message;
        if (Array.isArray(b.message)) {
          message = "Validation failed";
          errors = { validation: b.message as string[] };
        }
      }
    } else if (exception instanceof Error) {
      // Unhandled/unexpected error - log full detail, expose nothing.
      this.logger.error(exception.message, exception.stack, { requestId, path: req.originalUrl });
    }

    if (statusCode >= 500) {
      this.logger.error(message, undefined, { requestId, path: req.originalUrl, statusCode });
    }

    const payload: ApiErrorResponse = {
      statusCode,
      message,
      errors,
      requestId,
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
    };

    res.status(statusCode).json(payload);
  }
}
