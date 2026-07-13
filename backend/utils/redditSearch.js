// MOCKED DATA LAYER
// -----------------
// Reddit tightened non-commercial API access approval mid-project (see
// https://support.reddithelp.com/hc/en-us/articles/14945211791892 - "sign up"
// is now a separate gated request, not instant like it used to be).
//
// This file mocks that same function signature with realistic fixtures so
// the rest of the pipeline (extraction -> scoring -> UI) can be demoed
// end-to-end without waiting on approval.
//
// The real implementation (OAuth client-credentials flow + live Reddit
// search) is preserved untouched in redditSearch.live.js. Once your Reddit
// API access is approved, swapping back is a one-line change:
// rename this file to redditSearch.mock.js and redditSearch.live.js to
// redditSearch.js - nothing else in the codebase needs to change, since
// routes/analyze.js only imports { searchRedditForCompany } from this path.

// Deterministic hash so the same company name always produces the same
// mock result in a demo - no flaky randomness mid-interview.
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// A few named fixtures so specific demo companies behave consistently
// (matches the sample offer + earlier "recent scans" mockups).
const KNOWN_FIXTURES = {
  "brightfuture info pvt ltd": [
    { title: "Is BrightFuture Info legit or a scam?", url: "https://reddit.com/r/Internships/comments/mock1", source: "reddit", score: 42 },
    { title: "Beware - BrightFuture Info did not pay after 2 months", url: "https://reddit.com/r/developersIndia/comments/mock2", source: "reddit", score: 29 },
  ],
  "techspark solutions": [],
  "globalreach hr pvt ltd": [
    { title: "GlobalReach HR asked me for a 'training deposit' - normal?", url: "https://reddit.com/r/india/comments/mock3", source: "reddit", score: 11 },
  ],
};

// Generic scam-sounding keyword bank used to generate plausible mentions
// for any company name not in the fixtures above.
const SCAM_TEMPLATES = [
  (name) => `Is ${name} a scam? Got an offer, feels off`,
  (name) => `${name} asked me to pay a "registration fee" - red flag?`,
  (name) => `Warning about ${name} - never received stipend`,
  (name) => `Anyone else contacted by ${name} for an internship?`,
];

export async function searchRedditForCompany(companyName) {
  if (!companyName) return [];

  const key = companyName.toLowerCase().trim();
  if (KNOWN_FIXTURES[key]) return KNOWN_FIXTURES[key];

  // Simulate network latency so the popup's loading state still feels real
  await new Promise((resolve) => setTimeout(resolve, 400));

  const hash = hashString(key);
  const mentionCount = hash % 4; // 0-3 mentions, deterministic per company name

  const mentions = [];
  for (let i = 0; i < mentionCount; i++) {
    const template = SCAM_TEMPLATES[(hash + i) % SCAM_TEMPLATES.length];
    mentions.push({
      title: template(companyName),
      url: `https://reddit.com/r/Internships/comments/mock${hash}${i}`,
      source: "reddit",
      score: (hash + i * 7) % 80,
    });
  }
  return mentions;
}
