import express from "express";
import { router } from "./routes.js";
import { logger } from "../utils/logger.js";

const app = express();
const PORT = parseInt(process.env.API_PORT || "3456");

app.use(express.json());

// API routes
app.use("/api", router);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "openclaw-bot-api" });
});

app.listen(PORT, "0.0.0.0", () => {
  logger.info(`API server running on port ${PORT}`);
});
