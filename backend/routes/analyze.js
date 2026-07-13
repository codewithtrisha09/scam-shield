import express from "express";
import Company from "../models/Company.js";
import { extractFields } from "../utils/extractor.js";
import { extractFieldsWithLLM, needsLLMFallback } from "../utils/llmExtractor.js";
import { searchRedditForCompany } from "../utils/redditSearch.js";
import { computeRiskScore } from "../utils/scorer.js";
import { getReportCount } from "./report.js";
import { checkLinkedInPresence } from "../utils/linkedinCheck.js";
import { checkDomainAge } from "../utils/domainAge.js";

const router = express.Router();

router.post("/analyze", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== "string" || text.trim().length < 20) {
      return res.status(400).json({ error: "Please provide the offer text (at least 20 characters)." });
    }

    // Step 1: extract structured fields via regex (fast, free, no external call)
    let extracted = extractFields(text);
    let extractionMethod = "regex";

    // Step 1b: if regex came up mostly empty, fall back to an LLM call for
    // a single pass at structured extraction on messier real-world text
    if (needsLLMFallback(extracted)) {
      const llmResult = await extractFieldsWithLLM(text);
      if (llmResult) {
        extracted = {
          ...extracted,
          company: extracted.company || llmResult.company,
          role: extracted.role || llmResult.role,
          stipend: extracted.stipend || llmResult.stipend,
          eligibility: extracted.eligibility || llmResult.eligibility,
          emailDomain: extracted.emailDomain || llmResult.emailDomain,
          redFlags: [...new Set([...extracted.redFlags, ...(llmResult.redFlags || [])])],
        };
        extractionMethod = "regex+llm";
      }
    }

    // Step 2: check our Mongo cache first, only hit Reddit if stale/missing
    let mentions = [];
    if (extracted.company) {
      const normalized = extracted.company.toLowerCase().trim();
      let cached = await Company.findOne({ normalizedName: normalized });

      if (!cached || cached.isStale()) {
        const freshMentions = await searchRedditForCompany(extracted.company);

        cached = await Company.findOneAndUpdate(
          { normalizedName: normalized },
          {
            name: extracted.company,
            normalizedName: normalized,
            mentions: freshMentions,
            scamMentionCount: freshMentions.length,
            lastCheckedAt: new Date(),
          },
          { upsert: true, new: true }
        );
      }

      mentions = cached.mentions;
    }

    // Step 3: fetch user-submitted report count, domain age, and LinkedIn presence in parallel
    const [reportCount, domainAge, linkedIn] = await Promise.all([
      getReportCount(extracted.company),
      checkDomainAge(extracted.emailDomain),
      checkLinkedInPresence(extracted.company),
    ]);

    // Step 4: score it
    const { score, level, findings } = computeRiskScore({
      extracted,
      mentionCount: mentions.length,
      reportCount,
      domainAge,
      linkedIn,
    });

    res.json({
      extracted: {
        company: extracted.company,
        role: extracted.role,
        stipend: extracted.stipend,
        eligibility: extracted.eligibility,
        emailDomain: extracted.emailDomain,
      },
      extractionMethod,
      riskScore: score,
      riskLevel: level,
      findings,
      mentions: mentions.map((m) => ({ title: m.title, url: m.url })),
    });
  } catch (err) {
    console.error("Analyze error:", err);
    res.status(500).json({ error: "Something went wrong analyzing this offer." });
  }
});

export default router;
