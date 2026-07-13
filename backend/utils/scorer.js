import { FREE_EMAIL_DOMAINS } from "./extractor.js";

// Each rule adds risk points and produces a human-readable finding.
// This is deliberately explainable (not a black-box ML score) so you can
// justify every point in an interview: "why did this get flagged as 70/100?"
export function computeRiskScore({ extracted, mentionCount, reportCount = 0, domainAge = null, linkedIn = null }) {
  const findings = [];
  let score = 0;

  // 1. Free email domain used for "official" hiring communication
  if (extracted.emailDomain) {
    if (FREE_EMAIL_DOMAINS.has(extracted.emailDomain)) {
      score += 30;
      findings.push({
        severity: "bad",
        message: `Sent from a free email domain (${extracted.emailDomain}) instead of a company domain.`,
      });
    } else {
      findings.push({
        severity: "ok",
        message: `Sent from a company-looking domain (${extracted.emailDomain}).`,
      });
    }
  } else {
    findings.push({
      severity: "bad",
      message: "No email address found to verify the sender's domain.",
    });
    score += 10;
  }

  // 2. Explicit red-flag phrases found in the text (fees, urgency, docs, etc.)
  extracted.redFlags.forEach((msg) => {
    score += 15;
    findings.push({ severity: "bad", message: msg });
  });

  // 3. Missing core information a legitimate offer should have
  if (!extracted.stipend) {
    score += 10;
    findings.push({
      severity: "bad",
      message: "No stipend/salary figure could be found — vague offers are a common scam pattern.",
    });
  }
  if (!extracted.role) {
    score += 5;
    findings.push({
      severity: "bad",
      message: "No clear job role/title specified.",
    });
  }

  // 4. Reputation - mentions found alongside scam-related keywords
  if (mentionCount > 0) {
    score += Math.min(30, mentionCount * 10);
    findings.push({
      severity: "bad",
      message: `Found ${mentionCount} public post(s) discussing this company alongside scam-related keywords.`,
    });
  } else {
    findings.push({
      severity: "ok",
      message: "No scam-related public complaints found (note: this doesn't guarantee legitimacy for very new or small companies).",
    });
  }

  // 5. User-submitted reports - crowdsourced signal independent of Reddit
  if (reportCount > 0) {
    score += Math.min(25, reportCount * 12);
    findings.push({
      severity: "bad",
      message: `${reportCount} student(s) have directly reported this company as suspicious.`,
    });
  }

  // 6. Domain age - a domain registered days/weeks ago is a strong scam signal
  if (domainAge?.checked) {
    if (domainAge.ageDays < 30) {
      score += 25;
      findings.push({
        severity: "bad",
        message: `The company's domain was only registered ${domainAge.ageDays} day(s) ago (${domainAge.registeredOn}).`,
      });
    } else if (domainAge.ageDays < 180) {
      score += 10;
      findings.push({
        severity: "bad",
        message: `The company's domain is relatively new - registered ${domainAge.registeredOn}.`,
      });
    } else {
      findings.push({
        severity: "ok",
        message: `Domain has existed since ${domainAge.registeredOn} - not a brand-new registration.`,
      });
    }
  }

  // 7. LinkedIn presence - real companies almost always have a company page
  if (linkedIn?.checked) {
    if (linkedIn.found) {
      findings.push({
        severity: "ok",
        message: "Found a matching LinkedIn company page.",
      });
    } else {
      score += 15;
      findings.push({
        severity: "bad",
        message: "No matching LinkedIn company page found.",
      });
    }
  }

  score = Math.min(100, score);

  let level = "low";
  if (score >= 60) level = "high";
  else if (score >= 30) level = "medium";

  return { score, level, findings };
}
