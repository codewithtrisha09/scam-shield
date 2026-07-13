// Once deployed, replace this with your Render URL, e.g.
// const API_BASE = "https://scam-shield-backend.onrender.com";
const API_BASE = "http://localhost:5000";

const SAMPLE_OFFER = `Subject: Internship Opportunity at BrightFuture Info Pvt Ltd

Dear Candidate,

We are pleased to offer you the role of Data Entry Intern.
Stipend: 45000 per month.
Eligibility: Any graduate, no experience needed.

Please pay a refundable registration fee of 1500 to confirm your seat within 24 hours.

Contact: hr.brightfuture@gmail.com`;

const els = {
  textarea: document.getElementById("offerText"),
  btn: document.getElementById("analyzeBtn"),
  tryExample: document.getElementById("tryExample"),
  loading: document.getElementById("loading"),
  results: document.getElementById("results"),
  errorBox: document.getElementById("errorBox"),
  riskWord: document.getElementById("riskWord"),
  riskScore: document.getElementById("riskScore"),
  riskBarFill: document.getElementById("riskBarFill"),
  valCompany: document.getElementById("valCompany"),
  valRole: document.getElementById("valRole"),
  valStipend: document.getElementById("valStipend"),
  valDomain: document.getElementById("valDomain"),
  findingsList: document.getElementById("findingsList"),
  mentionsList: document.getElementById("mentionsList"),
  recentList: document.getElementById("recentList"),
  showReportForm: document.getElementById("showReportForm"),
  reportForm: document.getElementById("reportForm"),
  reportReason: document.getElementById("reportReason"),
  submitReport: document.getElementById("submitReport"),
  reportStatus: document.getElementById("reportStatus"),
};

let currentCompanyName = null; // tracks the company for the currently displayed result, used by the report form

const RISK_COLORS = { low: "#4ade80", medium: "#f0a83a", high: "#f0554a" };

// Remember last pasted text between popup opens (popup closes on blur by default)
chrome.storage?.local.get(["lastOfferText", "recentScans"], (data) => {
  if (data.lastOfferText) els.textarea.value = data.lastOfferText;
  renderRecentScans(data.recentScans || []);
});

els.textarea.addEventListener("input", () => {
  chrome.storage?.local.set({ lastOfferText: els.textarea.value });
});

els.tryExample.addEventListener("click", (e) => {
  e.preventDefault();
  els.textarea.value = SAMPLE_OFFER;
  chrome.storage?.local.set({ lastOfferText: SAMPLE_OFFER });
});

els.btn.addEventListener("click", async () => {
  const text = els.textarea.value.trim();
  if (!text) {
    showError("Paste the offer text first.");
    return;
  }

  setLoading(true);
  hide(els.errorBox);
  hide(els.results);

  try {
    const res = await fetch(`${API_BASE}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) throw new Error(`Server responded ${res.status}`);
    const data = await res.json();
    renderResults(data);
    saveToRecentScans(data);
  } catch (err) {
    showError(
      "Couldn't reach the analysis server. Is the backend running on localhost:5000?"
    );
    console.error(err);
  } finally {
    setLoading(false);
  }
});

function renderResults(data) {
  const { extracted, riskScore, riskLevel, findings, mentions } = data;
  currentCompanyName = extracted.company;

  // reset report form state for the new result
  hide(els.reportForm);
  els.reportReason.value = "";
  hide(els.reportStatus);
  els.submitReport.disabled = false;
  els.submitReport.textContent = "Submit report";

  els.riskWord.textContent = `${riskLevel.toUpperCase()} RISK`;
  els.riskWord.style.color = RISK_COLORS[riskLevel];
  els.riskScore.textContent = `${riskScore}/100`;
  els.riskBarFill.style.width = `${riskScore}%`;
  els.riskBarFill.style.background = RISK_COLORS[riskLevel];

  els.valCompany.textContent = extracted.company || "Not found";
  els.valRole.textContent = extracted.role || "Not found";
  els.valStipend.textContent = extracted.stipend || "Not found";
  els.valDomain.textContent = extracted.emailDomain || "Not found";

  els.findingsList.innerHTML = "";
  findings.forEach((f) => {
    const li = document.createElement("li");
    li.textContent = f.message;
    li.classList.add(f.severity === "ok" ? "ok" : "bad");
    els.findingsList.appendChild(li);
  });

  els.mentionsList.innerHTML = "";
  if (mentions.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No public mentions found (could mean too new, or too small to be indexed).";
    els.mentionsList.appendChild(li);
  } else {
    mentions.forEach((m) => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = m.url;
      a.target = "_blank";
      a.textContent = m.title;
      li.appendChild(a);
      els.mentionsList.appendChild(li);
    });
  }

  show(els.results);
}

function saveToRecentScans(data) {
  chrome.storage?.local.get(["recentScans"], (store) => {
    const entry = {
      company: data.extracted.company || "Unknown company",
      role: data.extracted.role || "Role not found",
      riskScore: data.riskScore,
      riskLevel: data.riskLevel,
      timestamp: Date.now(),
    };
    const updated = [entry, ...(store.recentScans || [])].slice(0, 5);
    chrome.storage.local.set({ recentScans: updated });
    renderRecentScans(updated);
  });
}

function renderRecentScans(scans) {
  els.recentList.innerHTML = "";
  if (scans.length === 0) {
    const li = document.createElement("li");
    li.className = "muted small";
    li.textContent = "No scans yet this session.";
    els.recentList.appendChild(li);
    return;
  }

  scans.forEach((s) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <div class="recent-info">
        <div class="recent-company">${escapeHtml(s.company)}</div>
        <div class="recent-sub">${escapeHtml(s.role)} · ${timeAgo(s.timestamp)}</div>
      </div>
      <div class="recent-badges">
        <span class="score-pill pill-${s.riskLevel}">${s.riskScore}</span>
        <span class="risk-tag tag-${s.riskLevel}">${s.riskLevel[0].toUpperCase() + s.riskLevel.slice(1)} risk</span>
      </div>
    `;
    els.recentList.appendChild(li);
  });
}

function timeAgo(ts) {
  const diffMin = Math.round((Date.now() - ts) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.round(diffHr / 24)}d ago`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

els.showReportForm.addEventListener("click", () => {
  els.reportForm.classList.toggle("hidden");
});

els.submitReport.addEventListener("click", async () => {
  const reason = els.reportReason.value.trim();
  if (!currentCompanyName) {
    els.reportStatus.textContent = "No company detected for this offer - can't file a report.";
    els.reportStatus.classList.remove("hidden");
    return;
  }
  if (reason.length < 5) {
    els.reportStatus.textContent = "Please describe what happened (at least 5 characters).";
    els.reportStatus.classList.remove("hidden");
    return;
  }

  els.submitReport.disabled = true;
  els.submitReport.textContent = "Submitting...";

  try {
    const res = await fetch(`${API_BASE}/api/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName: currentCompanyName, reason }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to submit report.");

    els.reportStatus.textContent = `Thanks - this company now has ${data.totalReports} report(s) on file.`;
    els.reportStatus.classList.remove("hidden");
    els.submitReport.textContent = "Reported ✓";
  } catch (err) {
    els.reportStatus.textContent = "Couldn't submit the report - try again later.";
    els.reportStatus.classList.remove("hidden");
    els.submitReport.disabled = false;
    els.submitReport.textContent = "Submit report";
    console.error(err);
  }
});

function setLoading(isLoading) {
  els.btn.disabled = isLoading;
  isLoading ? show(els.loading) : hide(els.loading);
}

function showError(msg) {
  els.errorBox.textContent = msg;
  show(els.errorBox);
}

function show(el) { el.classList.remove("hidden"); }
function hide(el) { el.classList.add("hidden"); }
