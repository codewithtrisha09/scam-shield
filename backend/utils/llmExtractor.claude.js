import fetch from "node-fetch";

// Uses Google's Gemini API (free tier) instead of Claude - Gemini's free
// tier is an ongoing free allowance (not just a one-time trial credit),
// which keeps this whole project running at $0.
//
// This only runs when regex extraction (extractor.js) fails to find the
// core fields - keeps the default path fast/free and only calls the LLM
// for messy edge cases.
//
// Setup: https://aistudio.google.com/apikey -> create a free API key,
// no credit card required. Set GEMINI_API_KEY in .env to enable.

const MODEL = "gemini-2.5-flash-lite"; // most generous free-tier quota (30 RPM / 1500 RPD as of mid-2026)

const SYSTEM_PROMPT = `You extract structured data from job/internship offer emails or messages.
Return ONLY a JSON object with exactly these keys:
{
  "company": string or null,
  "role": string or null,
  "stipend": string or null,
  "eligibility": string or null,
  "emailDomain": string or null,
  "redFlags": array of short strings, each describing one concrete scam red flag found in the text (e.g. upfront payment requests, urgency pressure, requests for sensitive documents, guaranteed placement claims). Empty array if none found.
}
If a field genuinely cannot be found in the text, use null for it. Do not guess or invent values.`;

export async function extractFieldsWithLLM(rawText) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY not set - skipping LLM extraction fallback.");
    return null;
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: `${SYSTEM_PROMPT}\n\nText to analyze:\n${rawText.slice(0, 4000)}` }],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json", // Gemini enforces valid JSON output, no markdown fences to strip
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`Gemini API responded ${res.status}`);
    }

    const data = await res.json();
    const rawOutput = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return JSON.parse(rawOutput);
  } catch (err) {
    console.error("LLM extraction fallback failed:", err.message);
    return null; // fail gracefully - regex result is still usable on its own
  }
}

// Decides whether regex extraction was "confident enough" or whether we
// should spend an API call trying to do better.
export function needsLLMFallback(extracted) {
  const fieldsFound = [extracted.company, extracted.role, extracted.stipend].filter(
    Boolean
  ).length;
  return fieldsFound <= 1; // 0 or 1 out of 3 core fields found = low confidence
}
