import "reflect-metadata";
import helmet from "helmet";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";
import { StructuredLogger } from "./common/logger/structured-logger.service";
import { buildCorsOptions } from "./common/cors";
import { configureBodyParsers } from "./common/body-parsers";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });
  configureBodyParsers(app);

  const logger = new StructuredLogger("Bootstrap");
  app.useLogger(logger);

  const config = app.get(ConfigService);

  app.use(helmet());

  const corsOrigins = (config.get<string>("CORS_ORIGINS") ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors(buildCorsOptions(corsOrigins, config.get<string>("NODE_ENV")));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.enableShutdownHooks();

  const port = config.get<number>("PORT")!;
  await app.listen(port);
  logger.log(`Illyrian Gym API listening on port ${port}`, { env: config.get("NODE_ENV") });
}

bootstrap();
