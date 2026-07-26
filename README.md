```markdown
# ScamShield

A full-stack scam-detection tool built for students navigating the job and internship hunt. ScamShield combines a Chrome extension and a companion website to flag common red flags in job offers — missing stipends, free-email domains posing as official HR, upfront fee requests, suspiciously new domains — while also offering an AI-powered resume-to-job-description matcher.

---

## Table of Contents

- [Project Structure](#project-structure)
- [How It Works](#how-it-works)
- [Features](#features)
- [Full-Stack Additions](#full-stack-additions-website-resume-analyzer-docker-cicd)
- [Reddit Data Layer](#reddit-data-layer--mocked-for-now)
- [Setup](#setup)
- [Scoring Model](#notes-on-the-scoring-model)
- [Roadmap](#ideas-for-further-extension)
- [Contributing](#suggestions-welcome)

---

## Project Structure

```

scam-shield/
├── extension/                Chrome extension (Manifest V3)
│   ├── manifest.json
│   ├── popup.html/css/js
│   ├── background.js
│   └── icons/
├── website/                  Static site (offer checker + resume analyzer)
│   └── index.html             served by the backend, same dark theme
├── backend/                   Node + Express + MongoDB API
│   ├── server.js
│   ├── routes/
│   │   ├── analyze.js          scam-offer analysis
│   │   ├── report.js           user-submitted company reports
│   │   └── resumeAnalyze.js    resume ↔ job-description matching
│   ├── utils/
│   │   ├── extractor.js        regex field extraction
│   │   ├── scorer.js           weighted risk scoring
│   │   ├── llmExtractor.js     Gemini extraction fallback
│   │   ├── resumeAnalyzer.js   Gemini resume matching
│   │   ├── domainAge.js        RDAP domain-age check
│   │   ├── linkedinCheck.js    LinkedIn presence via Google Search
│   │   └── redditSearch.js     mocked Reddit mentions (see below)
│   ├── models/                 Company.js, Report.js (Mongo schemas)
│   ├── Dockerfile
│   └── .dockerignore
├── docker-compose.yml         one-command local dev (backend + Mongo)
├── .github/workflows/ci-cd.yml    test → build Docker image → deploy
└── README.md

```

---

## How It Works

1. A user pastes offer text into the extension popup (or the website) and clicks **Analyze**.
2. The text is sent to `POST /api/analyze`.
3. The backend extracts company name, role, stipend, email domain, and red-flag phrases using regex (`extractor.js`). If extraction returns mostly empty fields, Gemini takes a second pass via `llmExtractor.js`.
4. In parallel, the backend checks cached/mocked Reddit mentions, the crowdsourced reports collection, the sender domain's registration age, and whether the company has a findable LinkedIn page.
5. `scorer.js` combines all signals into an explainable 0–100 risk score.
6. The UI renders the score, extracted fields, itemized findings, any mentions found, and a button to report the company directly.

---

## Features

All of the following are optional and free — the core app works fully without any of them configured.

### 1. LLM Extraction Fallback (Gemini API — free tier)
When regex extraction identifies fewer than two of the three core fields (company/role/stipend), `routes/analyze.js` calls Gemini via `utils/llmExtractor.js` for a second structured-extraction pass on messy real-world text. Set `GEMINI_API_KEY` in `.env` to enable — a free key with no credit card required is available at [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Uses `gemini-2.5-flash-lite` for its generous free-tier quota. If unset, this step is skipped and regex results are used as-is.

> A Claude-based equivalent is kept in `utils/llmExtractor.claude.js` for reference. Anthropic's API currently offers only a one-time trial credit rather than an ongoing free tier, so Gemini remains the default to keep the project fully free to run.

### 2. User-Submitted Reports
The popup includes a "Report this company" button on the results screen. Reports are stored in a dedicated `Report` MongoDB collection and factored into the risk score (`utils/scorer.js`) as a signal independent of Reddit — effectively a crowdsourced dataset that grows over time. No extra setup required; works as soon as MongoDB is connected.

### 3. Domain Age Check (RDAP — free, no key needed)
`utils/domainAge.js` queries the free RDAP API to determine how recently the sender's email domain was registered — a domain registered days ago is a strong scam signal. Nothing to configure; gracefully skipped if the lookup fails (e.g. for free-mail domains like gmail.com, which aren't independently registered).

### 4. LinkedIn Presence Check (Google Custom Search API — optional)
`utils/linkedinCheck.js` checks whether a company has a findable LinkedIn page using Google's Custom Search API (not scraping, which violates LinkedIn's ToS). Set `GOOGLE_SEARCH_API_KEY` and `GOOGLE_SEARCH_ENGINE_ID` in `.env` to enable — credentials available at [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials) and [programmablesearchengine.google.com](https://programmablesearchengine.google.com).

**Known limitation:** Google closed the Custom Search JSON API to new signups in 2025 and has scheduled full deprecation by January 1, 2027. Free-tier access (100 queries/day) may not be available for newly created projects. This feature is treated as fully optional and fails gracefully — if unconfigured or if Google returns an error, the check is skipped and every other signal still runs normally, consistent with the decision not to depend on a sunsetting API for a core feature.

---

## Full-Stack Additions: Website, Resume Analyzer, Docker, CI/CD

### Website
`website/index.html` is a single-file static site (matching the extension's dark theme) offering two tools: the job offer checker and the resume analyzer, plus a stats banner citing real scam-prevalence survey data to contextualize why the tool matters. `website/docs.html` is a full documentation page covering the architecture diagram, API reference for all three endpoints, the scoring model's point breakdown, and a link to the GitHub repo. Both pages are served directly by the Express backend (`server.js` serves `website/` as static files), so there is only one deployment target — visiting the Render URL shows the website, and the Chrome extension talks to the same backend's `/api/*` routes.

### Resume Analyzer
`POST /api/analyze-resume` accepts `{ resumeText, jobDescriptionText }` and returns a match score (0–100), matched/missing skills, and concrete suggestions, powered by Gemini (`utils/resumeAnalyzer.js`). Unlike the scam-detection extractor, this feature has no viable regex-only fallback, so it requires `GEMINI_API_KEY` — it fails with a clear error message if the key is missing, rather than silently degrading.

### Docker
```bash
cd backend
docker build -t scamshield-backend .
docker run -p 5000:5000 --env-file .env scamshield-backend
```

Or use Compose from the repo root for one-command local dev (spins up a local MongoDB too — no Atlas needed for local testing):
```bash
docker compose up
```

### CI/CD (GitHub Actions)
`.github/workflows/ci-cd.yml` runs on every push to `main`:
1. Installs dependencies and syntax-checks every `.js` file.
2. Builds a Docker image and pushes it to GitHub Container Registry (`ghcr.io/<your-username>/scamshield-backend`) — free for public repos.
3. Optionally triggers a Render deploy hook (only needed if auto-deploy-on-push is disabled; most users can skip this and let Render redeploy automatically).

No extra setup is needed for steps 1–2 — pushing to GitHub is enough to see the workflow run in the Actions tab. The entire pipeline is free: GitHub Actions offers generous minutes for public repos, and GHCR image storage is free as well.

### Rate Limiting
All `/api/*` routes share a single `express-rate-limit` instance (`server.js`): 20 requests per 15 minutes per IP. This protects free-tier Gemini and Google Search quotas from being exhausted by a single runaway client. In a production deployment, a separate, tighter limit on `/api/analyze-resume` would be worth adding, since it's the most expensive call (larger prompt, more output tokens) — noted here as a known scaling consideration rather than something this project needed to solve.

---

## Reddit Data Layer — Mocked for Now

Reddit tightened its non-commercial API approval process mid-project (access now requires a separate sign-up/approval step rather than instant registration). To keep the pipeline demoable end-to-end, `utils/redditSearch.js` currently returns realistic, deterministic mock fixtures instead of calling the live API.

The real OAuth implementation is preserved untouched in `utils/redditSearch.live.js`. Once Reddit approves API access:

1. Rename `utils/redditSearch.js` → `utils/redditSearch.mock.js`
2. Rename `utils/redditSearch.live.js` → `utils/redditSearch.js`

Nothing else changes — `routes/analyze.js` only imports `{ searchRedditForCompany }` from `./utils/redditSearch.js`, so the swap is a one-file change regardless of implementation.

---

## Setup

### 1. MongoDB
Create a free cluster on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and copy the connection string, or run MongoDB locally:
```bash
mongod --dbpath ./data
```

### 2. Backend
```bash
cd backend
npm install
cp .env.example .env
# edit .env with your MONGODB_URI — the only required value; everything else is optional (see Features above)
npm run dev
```

Expected output:
```
Connected to MongoDB
Server running on http://localhost:5000
```

Test the endpoint directly:
```bash
curl -X POST http://localhost:5000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"text": "Company: BrightFuture Info Pvt Ltd. Role: Data Entry Intern. Stipend: 45000 per month. Please pay a refundable registration fee of 1500 to confirm your seat. Contact: hr.brightfuture@gmail.com"}'
```

### 3. Load the Extension in Chrome
1. Go to `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `extension/` folder
5. Pin the ScamShield icon, click it, paste an offer, and hit Analyze

---

## Notes on the Scoring Model

The risk score is rule-based and additive (see `utils/scorer.js`), not a trained ML model. This is a deliberate design choice: it's fully explainable — every flagged offer can be traced back to specific signals — which is both more trustworthy for end users and easier to justify in a technical interview than a black-box classifier.

---

## Ideas for Further Extension

- Live Reddit data once API access is approved (see [Reddit Data Layer](#reddit-data-layer--mocked-for-now))
- A content script that auto-detects Gmail messages and offers to prefill the popup, removing manual copy-paste
- Deployment of the backend to Render (free tier) and publishing the extension to the Chrome Web Store
- A general web-mentions search (beyond LinkedIn) using the existing Google Custom Search setup, to supplement the mocked Reddit data with something genuinely live
- Push notifications when a cached "known scam" company reappears in a newly pasted offer

---

## Suggestions Welcome

This is a personal/portfolio project, but bug reports, heuristic ideas, and feature requests are welcome — open an issue or a pull request anytime.
```

