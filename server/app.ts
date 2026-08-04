import express from "express";
import dotenv from "dotenv";
import { authRoutes } from "./routes/auth";
import { invoiceRoutes } from "./routes/invoices";
import { ocrRoutes } from "./routes/ocr";
import { aiRoutes } from "./routes/ai";

dotenv.config();

export function createApp() {
  const app = express();
  app.use(express.json({ limit: "25mb" }));

  app.use("/api/auth", authRoutes());
  app.use("/api/invoices", invoiceRoutes());
  app.use("/api/dashboard", invoiceRoutes()); // /api/dashboard alias
  app.use("/api/ocr-invoice", ocrRoutes());
  app.use("/api/ebdAi", aiRoutes());

  return app;
}
