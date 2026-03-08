import path from "node:path";

import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";

import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { apiRoutes } from "./routes/index.js";

export const app = express();

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Not allowed by CORS"));
    },
    credentials: true
  })
);
app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

app.get("/", (_request, response) => {
  response.status(200).json({
    message: "CORE API running",
    docs: "/api/health"
  });
});

app.use("/api", apiRoutes);
app.use(errorHandler);
