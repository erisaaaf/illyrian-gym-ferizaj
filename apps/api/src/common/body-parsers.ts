import { INestApplication } from "@nestjs/common";
import { json, urlencoded } from "express";

/**
 * Body parsing is configured by hand so only the photo upload route may carry a large (base64) body;
 * everything else keeps a small limit. Shared by the real bootstrap and the e2e harness so tests exercise the same limits.
 * The application must be created with `bodyParser: false`.
 */
export function configureBodyParsers(app: INestApplication) {
  app.use("/body/photos", json({ limit: "5mb" }));
  app.use(json({ limit: "200kb" }));
  app.use(urlencoded({ extended: true, limit: "200kb" }));
}
