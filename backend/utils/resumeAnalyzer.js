import fetch from "node-fetch";

// Resume analysis needs actual language understanding (matching skills,
// inferring seniority, judging relevance) - unlike the scam-detection
// extractor, there's no sensible regex-only version of this feature, so
// it requires GEMINI_API_KEY to be set.

const GEMINI_MODEL = "gemini-2.5-flash-lite";

const SYSTEM_INSTRUCTION = `You are a resume-to-job-description matching assistant.
Given a candidate's resume text and a job description, analyze the fit.
Return ONLY a valid JSON object, no markdown, no code fences, no preamble, with exactly these keys:
{
  "matchScore": number from 0-100 representing overall fit,
  "summary": a 1-2 sentence plain-language summary of the fit,
  "matchedSkills": array of specific skills/requirements from the job description that the resume clearly demonstrates,
  "missingSkills": array of specific skills/requirements from the job description that the resume does NOT show evidence of,
  "suggestions": array of 3-5 short, concrete, actionable suggestions to improve the resume for this specific role (e.g. "Add a project demonstrating SQL usage" rather than vague advice like "improve your resume")
}
Be honest and specific - do not inflate the match score to be encouraging. Base every claim only on what's actually in the resume text provided.`;

export async function analyzeResumeMatch(resumeText, jobDescriptionText) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY is not set - this feature requires it. Get a free key at https://aistudio.google.com/apikey"
    );
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`;

  const userContent = `RESUME:\n${resumeText.slice(0, 6000)}\n\nJOB DESCRIPTION:\n${jobDescriptionText.slice(0, 4000)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      contents: [{ parts: [{ text: userContent }] }],
      generationConfig: { responseMimeType: "application/json" },
    }),
  });

  if (!res.ok) {
    throw new Error(`Gemini API responded ${res.status}`);
  }

  const data = await res.json();
  const rawOutput = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return JSON.parse(rawOutput.trim());
}
