import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { StructuredLogger } from "../logger/structured-logger.service";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/**
 * Development placeholder mailer. No email provider has been selected yet
 * (see .env.example EMAIL_PROVIDER and docs/architecture.md#open-decisions).
 * Until one is wired up, this logs the message instead of sending it so
 * auth flows (verification, password reset) remain fully testable locally.
 * Swap the body of `send` for a real provider (Resend/Postmark/SES) without
 * changing any caller - this is the only place that needs to change.
 */
@Injectable()
export class MailerService {
  private readonly logger = new StructuredLogger("Mailer");

  constructor(private readonly config: ConfigService) {}

  async send(message: MailMessage): Promise<void> {
    const provider = this.config.get<string>("EMAIL_PROVIDER");
    if (!provider) {
      this.logger.warn("EMAIL_PROVIDER not configured - logging email instead of sending", {
        to: message.to,
        subject: message.subject,
      });
      console.log(`[DEV EMAIL] to=${message.to} subject="${message.subject}"\n${message.text}`);
      return;
    }
    throw new Error(`Email provider "${provider}" is not yet implemented`);
  }
}
