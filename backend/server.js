import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import analyzeRoute from "./routes/analyze.js";
import reportRoute from "./routes/report.js";
import resumeRoute from "./routes/resumeAnalyze.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors()); // extension popup runs on a chrome-extension:// origin, needs CORS open
app.use(express.json({ limit: "1mb" }));

// Serves the website in ../website as static files - same backend, one deploy
app.use(express.static(path.join(__dirname, "..", "website")));

// Protects your Reddit API quota once this is deployed publicly -
// caps each IP to 20 analyses per 15 minutes, plenty for a demo/interview.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: { error: "Too many requests — please wait a few minutes and try again." },
});
app.use("/api", limiter);

app.use("/api", analyzeRoute);
app.use("/api", reportRoute);
app.use("/api", resumeRoute);

app.get("/api/status", (req, res) => {
  res.json({ status: "ScamShield backend is running." });
});

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("Connected to MongoDB");
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  });
