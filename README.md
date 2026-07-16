# ScamShield

A full-stack scam-detection tool for students job-hunting: a Chrome
extension and a website that check job/internship offers for scam red
flags (missing stipend, free-email domains posing as "official" HR,
upfront fee requests, suspiciously new domains, crowdsourced reports),
plus an AI resume-to-job-description matcher.

## Project structure

```
scam-shield/
├── extension/              Chrome extension (Manifest V3)
│   ├── manifest.json
│   ├── popup.html/css/js
│   ├── background.js
│   └── icons/
├── website/                 Static site (offer checker + resume analyzer)
│   └── index.html            served by the backend, same dark theme
├── backend/                  Node + Express + MongoDB API
│   ├── server.js
│   ├── routes/
│   │   ├── analyze.js         scam-offer analysis
│   │   ├── report.js          user-submitted company reports
│   │   └── resumeAnalyze.js   resume ↔ job-description matching
│   ├── utils/
│   │   ├── extractor.js       regex field extraction
│   │   ├── scorer.js          weighted risk scoring
│   │   ├── llmExtractor.js    Gemini extraction fallback
│   │   ├── resumeAnalyzer.js  Gemini resume matching
│   │   ├── domainAge.js       RDAP domain-age check
│   │   ├── linkedinCheck.js   LinkedIn presence via Google Search
│   │   └── redditSearch.js    mocked Reddit mentions (see below)
│   ├── models/                Company.js, Report.js (Mongo schemas)
│   ├── Dockerfile
│   └── .dockerignore
├── docker-compose.yml        one-command local dev (backend + Mongo)
├── .github/workflows/ci-cd.yml   test → build Docker image → deploy
└── README.md
```

## How it works

1. User pastes offer text into the popup (or website) and hits **Analyze**.
2. The text is sent to `POST /api/analyze`.
3. Backend extracts company name, role, stipend, email domain, and red-flag
   phrases using regex (`extractor.js`); if that comes up mostly empty,
   Gemini takes a second pass (`llmExtractor.js`).
4. In parallel, the backend checks: cached/mocked Reddit mentions, your own
   crowdsourced reports collection, the sender domain's registration age,
   and whether the company has a findable LinkedIn page.
5. `scorer.js` combines all signals into an explainable 0–100 risk score.
6. The UI renders the score, extracted fields, itemized findings, and any
   mentions found - plus a button to report the company yourself.

## New features (all optional, all FREE - app works fine without any configured)

### 1. LLM extraction fallback (Gemini API - free tier)
When regex extraction finds fewer than 2 of the 3 core fields (company/role/
stipend), `routes/analyze.js` calls Gemini via `utils/llmExtractor.js` to
have one more attempt at structured extraction on messy real-world text.
Set `GEMINI_API_KEY` in `.env` to enable it - get one free, no credit card,
at https://aistudio.google.com/apikey. Uses `gemini-2.5-flash-lite`, which
has the most generous free-tier quota. If unset, this step is just skipped
and regex results are used as-is.

(A Claude-based version of this same file is kept in
`utils/llmExtractor.claude.js` for reference - Anthropic's API only offers
a one-time trial credit, not an ongoing free tier, so Gemini is the
default here to keep the whole project at $0.)

### 2. User-submitted reports
The popup now has a "Report this company" button on the results screen.
Reports are stored in a separate `Report` Mongo collection and factored
into the risk score (`utils/scorer.js`) as an independent signal from
Reddit - this is your own crowdsourced dataset that grows over time. No
extra setup needed - works as soon as MongoDB is connected.

### 3. Domain age check (RDAP, free, no key needed)
`utils/domainAge.js` queries the free RDAP API to see how long ago the
sender's email domain was registered - a domain registered days ago is a
strong scam signal. Nothing to configure; gracefully skipped if the
lookup fails (e.g. for free-mail domains like gmail.com, which aren't
independently registered).

### 4. LinkedIn presence check (Google Custom Search API, free tier)
`utils/linkedinCheck.js` checks whether the company has a findable
LinkedIn company page, using Google's Custom Search API (not scraping,
which violates LinkedIn's ToS). Set `GOOGLE_SEARCH_API_KEY` and
`GOOGLE_SEARCH_ENGINE_ID` in `.env` to enable - get them at
https://console.cloud.google.com/apis/credentials and
https://programmablesearchengine.google.com. Free tier: 100 queries/day.
If unset, this check is just skipped.

## Full-stack additions: website, resume analyzer, Docker, CI/CD

### Website
`website/index.html` is a single-file static site (same dark theme as the
extension) with two tools: the job offer checker and a resume analyzer,
plus a stats banner citing real scam-prevalence survey data (with source
link) to set context for why the tool matters. `website/docs.html` is a
proper documentation page - architecture diagram, full API reference for
all three endpoints, the scoring model's point breakdown, and a link to
the GitHub repo. Both are served directly by the Express backend
(`server.js` serves `website/` as static files), so there's only one thing
to deploy - visiting your Render URL shows the website; the Chrome
extension talks to the same backend's `/api/*` routes.

### Resume analyzer (new feature)
`POST /api/analyze-resume` takes `{ resumeText, jobDescriptionText }` and
returns a match score (0-100), matched/missing skills, and concrete
suggestions - powered by Gemini (`utils/resumeAnalyzer.js`). Unlike the
scam-detection extractor, this feature has no sensible regex-only version,
so it requires `GEMINI_API_KEY` to be set - it fails with a clear error
message if the key is missing, rather than silently degrading.

### Docker
```bash
cd backend
docker build -t scamshield-backend .
docker run -p 5000:5000 --env-file .env scamshield-backend
```
Or use Compose from the repo root for one-command local dev (spins up a
local MongoDB too, no Atlas needed for local testing):
```bash
docker compose up
```

### CI/CD (GitHub Actions)
`.github/workflows/ci-cd.yml` runs on every push to `main`:
1. Installs dependencies, syntax-checks every `.js` file
2. Builds a Docker image and pushes it to GitHub Container Registry
   (`ghcr.io/<your-username>/scamshield-backend`) - free for public repos
3. Optionally triggers a Render deploy hook (only needed if you've turned
   off Render's own auto-deploy-on-push - most people can skip this and
   just let Render redeploy automatically when it sees a new push)

No extra setup needed for steps 1-2 - just push to GitHub and the Actions
tab will show it running. Nothing here costs money; GitHub Actions is free
for public repos with generous minutes, and GHCR image storage is free too.

### Rate limiting
All `/api/*` routes share one `express-rate-limit` instance (`server.js`):
20 requests per 15 minutes per IP. This protects your free-tier Gemini and
Google Search quotas from being exhausted by one runaway client. For a
real production deployment, you'd likely want a separate, tighter limit
specifically on `/api/analyze-resume`, since it's the most expensive call
(larger prompt, more output tokens) - noted here as a known scaling
consideration rather than something this project needed to solve.

## Reddit data layer — mocked for now

Reddit tightened their non-commercial API approval process mid-project
(access now requires a separate sign-up/approval step, not instant
registration). To keep the pipeline demoable end-to-end, `utils/redditSearch.js`
currently returns realistic, deterministic mock fixtures instead of calling
the live API.

The real OAuth implementation is preserved untouched in
`utils/redditSearch.live.js`. Once Reddit approves your API access:

1. Rename `utils/redditSearch.js` → `utils/redditSearch.mock.js`
2. Rename `utils/redditSearch.live.js` → `utils/redditSearch.js`

Nothing else changes — `routes/analyze.js` only imports
`{ searchRedditForCompany }` from `./utils/redditSearch.js`, so the swap is
a one-file change regardless of which implementation is behind it.

## Setup

### 1. MongoDB

Easiest option: create a free cluster on
[MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and copy the connection
string. Or run MongoDB locally if you have it installed:

```bash
mongod --dbpath ./data
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
# edit .env with your MONGODB_URI (only required value - everything else is optional, see "New features" above)
npm run dev
```

You should see:
```
Connected to MongoDB
Server running on http://localhost:5000
```

Test it directly:
```bash
curl -X POST http://localhost:5000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"text": "Company: BrightFuture Info Pvt Ltd. Role: Data Entry Intern. Stipend: 45000 per month. Please pay a refundable registration fee of 1500 to confirm your seat. Contact: hr.brightfuture@gmail.com"}'
```

### 3. Load the extension in Chrome

1. Go to `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `extension/` folder
5. Pin the ScamShield icon, click it, paste an offer, hit Analyze

## Ideas for further extension

- Live Reddit data once API access is approved (see "Reddit data layer" above)
- A content script that auto-detects when you're viewing a Gmail message and
  offers to prefill the popup, instead of manual copy-paste
- Deploy the backend to Render (free tier) and publish the extension to the
  Chrome Web Store
- A general web-mentions search (beyond LinkedIn) using the same Google
  Custom Search setup already in place, to supplement the currently-mocked
  Reddit data with something genuinely live
- Push notifications when a cached "known scam" company reappears in a new
  pasted offer

## Notes on the scoring model

The score is rule-based and additive (see `utils/scorer.js`), not a trained
ML model. This is a deliberate choice: it's fully explainable — you can
show exactly why any offer got flagged, which is both more trustworthy for
users and easier to defend in an interview than a black-box classifier

## Suggestions welcome

This is a personal/portfolio project, but if you spot a bug, have an idea
for a better heuristic, or want to add a feature, open an issue or a pull
request — always happy to hear how this could be improved.
