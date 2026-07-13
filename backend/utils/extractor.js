// Rule-based extraction. This is intentionally simple to start with -
// you can swap this out later for an LLM call (Claude API) that returns
// structured JSON, which will be far more robust on messy real-world emails.

const STIPEND_REGEX =
  /(?:stipend|salary|package|ctc|compensation)[^\d₹$]{0,15}([₹$]?\s?[\d,]+(?:\.\d+)?\s?(?:k|lpa|per month|\/month|\/mo)?)/i;

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;

// [^.\n]{2,50} stops the match at the first period/newline so it can't
// bleed into the next sentence (e.g. "BrightFuture Info Pvt Ltd. We are pleased...")
const COMPANY_HINTS = [
  /(?:company|organization|organisation)\s*[:\-]\s*([A-Z][^.\n]{2,50})/i,
  /(?:welcome to|on behalf of)\s+([A-Z][^.\n]{2,50})/i,
  // "...role at Optimspace." / "...position at BrightFuture Info Pvt Ltd"
  // Allows up to 3 words between the keyword and "at" (e.g. "Internship Opportunity at X")
  /(?:role|position|job|internship)(?:\s+\w+){0,3}\s+at\s+([A-Z][^.\n]{1,50})/i,
];

const ROLE_HINTS = [
  /(?:role|position|designation|job title)\s*[:\-]\s*([^.\n]{2,60})/i,
  /(?:offer(?:ing)? you the (?:role|position) of)\s+([^.\n]{2,60})/i,
];

// Job-board format: "Data Analyst Intern @ Optimspace" (Indeed, LinkedIn, etc.)
// Requires Title-Case words on both sides so it doesn't accidentally match
// something like "hr.brightfuture@gmail.com" (lowercase email local part).
const ROLE_AT_COMPANY_REGEX =
  /\b([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+){0,5})\s@\s*([A-Z][\w.&-]{1,40})/;

const ELIGIBILITY_HINTS = [
  /(?:eligibility|eligible candidates?|requirements?)\s*[:\-]\s*([^\n]{2,150}?)(?:\. |\n|$)/i,
];

// Phrases commonly seen in scam/fraudulent internship postings
const RED_FLAG_PHRASES = [
  { phrase: /registration fee|processing fee|refundable deposit|security deposit/i, message: "Mentions an upfront fee or deposit — legitimate employers never charge candidates to work." },
  { phrase: /pay.{0,20}(training|kit|material|laptop)/i, message: "Asks you to pay for training materials or equipment." },
  { phrase: /western union|moneygram|gift card|crypto(?:currency)?|bitcoin/i, message: "Requests payment via untraceable methods (gift cards, crypto, wire transfer)." },
  { phrase: /urgent(?:ly)?|act now|limited (?:slots|seats)|within 24 hours/i, message: "Uses high-pressure urgency language to rush your decision." },
  { phrase: /send.{0,20}(aadhar|passport|bank details|account number|otp)/i, message: "Asks for sensitive personal/financial documents very early in the process." },
  { phrase: /no interview|without interview|guaranteed (?:job|placement|offer)/i, message: "Guarantees a job/offer with no interview — real hiring almost always involves screening." },
];

export function extractFields(rawText) {
  // Collapse horizontal whitespace (spaces/tabs) but KEEP line breaks -
  // several patterns below rely on \n as a stopping point so they don't
  // bleed across paragraphs. Multiple blank lines collapse to one.
  const text = rawText.replace(/[ \t]+/g, " ").replace(/\n{2,}/g, "\n").trim();

  let company = matchFirst(COMPANY_HINTS, text);
  let role = matchFirst(ROLE_HINTS, text);
  const eligibility = matchFirst(ELIGIBILITY_HINTS, text);

  // Fallback: job-board "Role @ Company" format catches whichever of the
  // two labeled hints above didn't find anything.
  if (!company || !role) {
    const atMatch = text.match(ROLE_AT_COMPANY_REGEX);
    if (atMatch) {
      if (!role) role = atMatch[1].trim();
      if (!company) company = atMatch[2].trim().replace(/\.$/, "");
    }
  }

  const stipendMatch = text.match(STIPEND_REGEX);
  const stipend = stipendMatch ? stipendMatch[1].trim() : null;

  const emailMatch = text.match(EMAIL_REGEX);
  const emailDomain = emailMatch ? emailMatch[1].toLowerCase() : null;

  const redFlags = RED_FLAG_PHRASES.filter((rf) => rf.phrase.test(text)).map(
    (rf) => rf.message
  );

  return {
    company,
    role,
    stipend,
    eligibility,
    emailDomain,
    redFlags,
    rawTextLength: text.length,
  };
}

function matchFirst(patterns, text) {
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m) return m[1].trim().replace(/[.,]$/, "");
  }
  return null;
}

// Free-mail domains are a red flag when used for "official" company communication
export const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "rediffmail.com",
  "protonmail.com",
]);
