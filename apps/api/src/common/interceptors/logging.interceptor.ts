import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable, tap } from "rxjs";
import { StructuredLogger } from "../logger/structured-logger.service";
import { RequestWithId } from "../middleware/request-id.middleware";

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new StructuredLogger("HTTP");

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<RequestWithId>();
    const res = context.switchToHttp().getResponse();
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => this.log(req, res.statusCode, start),
        error: (err) => this.log(req, err?.status ?? 500, start),
      }),
    );
  }

  private log(req: RequestWithId, statusCode: number, start: number) {
    this.logger.log("request", {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode,
      durationMs: Date.now() - start,
      userId: (req as unknown as { user?: { sub?: string } }).user?.sub,
    });
  }
}
