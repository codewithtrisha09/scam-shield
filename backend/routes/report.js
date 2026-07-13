import express from "express";
import Report from "../models/Report.js";

const router = express.Router();

// Submit a new user report about a company
router.post("/report", async (req, res) => {
  try {
    const { companyName, reason } = req.body;

    if (!companyName || typeof companyName !== "string" || !companyName.trim()) {
      return res.status(400).json({ error: "companyName is required." });
    }
    if (!reason || typeof reason !== "string" || reason.trim().length < 5) {
      return res.status(400).json({ error: "Please describe the issue (at least 5 characters)." });
    }

    const report = await Report.create({
      companyName: companyName.trim(),
      normalizedName: companyName.trim().toLowerCase(),
      reason: reason.trim().slice(0, 500),
    });

    const totalReports = await Report.countDocuments({
      normalizedName: report.normalizedName,
    });

    res.json({ success: true, totalReports });
  } catch (err) {
    console.error("Report submission error:", err);
    res.status(500).json({ error: "Couldn't submit the report right now." });
  }
});

// Used internally by the scorer to factor user reports into the risk score
export async function getReportCount(companyName) {
  if (!companyName) return 0;
  try {
    return await Report.countDocuments({
      normalizedName: companyName.trim().toLowerCase(),
    });
  } catch (err) {
    console.error("Report count lookup failed:", err.message);
    return 0;
  }
}

export default router;
