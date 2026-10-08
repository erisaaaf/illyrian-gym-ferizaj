import { Injectable, LoggerService, Scope } from "@nestjs/common";

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

/**
 * JSON-line structured logger so log aggregators (CloudWatch, Loki, Datadog,
 * etc.) can parse fields instead of grepping free text. Never log secrets,
 * passwords, tokens, or full request bodies - see section 53/37 of the spec.
 *
 * Implements Nest's LoggerService directly (rather than extending
 * ConsoleLogger) because Nest's own framework internals call this with a
 * plain string `context` as the trailing arg, while our own call sites pass
 * a structured `meta` object - both must be handled without the string
 * accidentally getting spread character-by-character into the log entry.
 */
@Injectable({ scope: Scope.TRANSIENT })
export class StructuredLogger implements LoggerService {
  private context?: string;
  private minLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || "info";

  constructor(context?: string) {
    this.context = context;
  }

  setContext(context: string) {
    this.context = context;
  }

  private write(level: LogLevel, message: unknown, context: string | undefined, meta?: Record<string, unknown>) {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.minLevel]) return;
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      context,
      message,
      ...meta,
    };
    console.log(JSON.stringify(entry));
  }

  /** Splits a trailing arg into (context, meta) - a string is a context override, an object is meta. */
  private splitExtra(extra: unknown): { context: string | undefined; meta: Record<string, unknown> | undefined } {
    if (typeof extra === "string") return { context: extra, meta: undefined };
    if (extra !== null && typeof extra === "object" && !Array.isArray(extra)) {
      return { context: this.context, meta: extra as Record<string, unknown> };
    }
    return { context: this.context, meta: undefined };
  }

  log(message: unknown, extra?: unknown) {
    const { context, meta } = this.splitExtra(extra);
    this.write("info", message, context, meta);
  }

  debug(message: unknown, extra?: unknown) {
    const { context, meta } = this.splitExtra(extra);
    this.write("debug", message, context, meta);
  }

  warn(message: unknown, extra?: unknown) {
    const { context, meta } = this.splitExtra(extra);
    this.write("warn", message, context, meta);
  }

  verbose(message: unknown, extra?: unknown) {
    const { context, meta } = this.splitExtra(extra);
    this.write("debug", message, context, meta);
  }

  /** Nest's built-in convention is error(message, trace?, context?); ours is error(message, trace?, meta?). */
  error(message: unknown, trace?: string, extra?: unknown) {
    const { context, meta } = this.splitExtra(extra);
    this.write("error", message, context, { ...meta, trace });
  }
}
