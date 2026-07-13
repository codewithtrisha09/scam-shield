import express from "express";
import { analyzeResumeMatch } from "../utils/resumeAnalyzer.js";

const router = express.Router();

router.post("/analyze-resume", async (req, res) => {
  try {
    const { resumeText, jobDescriptionText } = req.body;

    if (!resumeText || resumeText.trim().length < 50) {
      return res.status(400).json({ error: "Please provide resume text (at least 50 characters)." });
    }
    if (!jobDescriptionText || jobDescriptionText.trim().length < 20) {
      return res.status(400).json({ error: "Please provide the job description text (at least 20 characters)." });
    }

    const result = await analyzeResumeMatch(resumeText, jobDescriptionText);
    res.json(result);
  } catch (err) {
    console.error("Resume analysis error:", err.message);
    res.status(500).json({ error: err.message || "Couldn't analyze the resume right now." });
  }
});

export default router;
