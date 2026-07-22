import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { authRouter } from "./routes/auth.routes.js";
import { uploadRouter } from "./routes/upload.routes.js";
import { dashboardRouter } from "./routes/dashboard.routes.js";
import { targetsRouter } from "./routes/targets.routes.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();

// OutageEvent.eventNo is a BigInt (Prisma maps it that way for large PEA
// event IDs); JSON.stringify can't handle BigInt natively, so every response
// needs it stringified here rather than at each call site.
app.set("json replacer", (_key: string, value: unknown) =>
  typeof value === "bigint" ? value.toString() : value
);

app.use(cors({ origin: env.corsOrigins }));
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRouter);
app.use("/api/uploads", uploadRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/targets", targetsRouter);

app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`API listening on http://localhost:${env.port}`);
});
