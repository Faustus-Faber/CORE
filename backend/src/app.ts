import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import path from "path"; // 1. Add this import

import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { apiRoutes } from "./routes/index.js";

export const app = express();

app.use(
    cors({
        origin: true,
        credentials: true
    })
);

app.use(cookieParser());
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// 2. ADD THIS LINE: This exposes the "uploads" folder so images show up
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.get("/", (_request, response) => {
    response.status(200).json({
        message: "CORE API running",
        docs: "/api/health"
    });
});

app.use("/api", apiRoutes);
app.use(errorHandler);
