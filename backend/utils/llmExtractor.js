import fetch from "node-fetch";

// This only runs when regex extraction (extractor.js) fails to find the
// core fields - keeps cost/latency low by using the cheap rule-based path
// as the default and only falling back to an LLM call for messy edge cases.
//
// Uses Google's Gemini API (free tier - no credit card required, generous
// daily request limits on Flash models). Get a key at https://aistudio.google.com/apikey

const SYSTEM_INSTRUCTION = `You extract structured data from job/internship offer emails or messages.
Return ONLY a valid JSON object, no markdown formatting, no code fences, no preamble - just the raw JSON.
Use exactly these keys:
{
  "company": string or null,
  "role": string or null,
  "stipend": string or null,
  "eligibility": string or null,
  "emailDomain": string or null,
  "redFlags": array of short strings, each describing one concrete scam red flag found in the text (e.g. upfront payment requests, urgency pressure, requests for sensitive documents, guaranteed placement claims). Empty array if none found.
}
If a field genuinely cannot be found in the text, use null for it. Do not guess or invent values.`;

const GEMINI_MODEL = "gemini-2.5-flash-lite"; // most generous free-tier quota - see https://ai.google.dev/gemini-api/docs/pricing

export async function extractFieldsWithLLM(rawText) {
  if (!process.env.GEMINI_API_KEY) {
    console.warn("GEMINI_API_KEY not set - skipping LLM extraction fallback.");
    return null;
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [{ parts: [{ text: rawText.slice(0, 4000) }] }],
        generationConfig: {
          responseMimeType: "application/json", // Gemini's JSON mode - guarantees parseable output, no fence-stripping needed
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`Gemini API responded ${res.status}`);
    }

    const data = await res.json();
    const rawOutput = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return JSON.parse(rawOutput.trim());
  } catch (err) {
    console.error("LLM extraction fallback failed:", err.message);
    return null; // fail gracefully - regex result is still usable on its own
  }
}

// Decides whether regex extraction was "confident enough" or whether we
// should spend a Gemini API call trying to do better.
export function needsLLMFallback(extracted) {
  const fieldsFound = [extracted.company, extracted.role, extracted.stipend].filter(
    Boolean
  ).length;
  return fieldsFound <= 1; // 0 or 1 out of 3 core fields found = low confidence
}
