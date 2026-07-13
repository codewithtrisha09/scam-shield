# ScamShield

A browser extension that checks job/internship offers for scam red flags:
missing stipend, free-email domains posing as "official" HR, upfront fee
requests, and public Reddit complaints about the company.

## Project structure

```
scam-shield/
├── extension/          Chrome extension (Manifest V3)
│   ├── manifest.json
│   ├── popup.html/css/js
│   ├── background.js
│   └── icons/
├── backend/             Node + Express + MongoDB API
│   ├── server.js
│   ├── routes/analyze.js
│   ├── utils/extractor.js    (regex field extraction)
│   ├── utils/scorer.js       (weighted risk scoring)
│   ├── utils/redditSearch.js (Reddit OAuth + search)
│   └── models/Company.js     (Mongo cache schema)
└── README.md
```

## How it works

1. User pastes offer text into the popup and hits **Analyze**.
2. `popup.js` sends the text to `POST http://localhost:5000/api/analyze`.
3. Backend extracts company name, role, stipend, email domain, and red-flag
   phrases using regex (`extractor.js`).
4. Backend checks MongoDB for a cached Reddit search on that company name;
   if missing or older than 7 days, it re-searches Reddit and caches it.
5. `scorer.js` combines all signals into an explainable 0–100 risk score.
6. Popup renders the score, extracted fields, findings, and any Reddit
   mentions found.

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
extension) with two tools: the job offer checker and a new resume analyzer.
It's served directly by the Express backend (`server.js` now serves
`website/` as static files), so there's only one thing to deploy - visiting
your Render URL in a browser shows the website; the Chrome extension talks
to the same backend's `/api/*` routes.

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

### 2. Reddit API credentials (free)

1. Go to https://www.reddit.com/prefs/apps
2. Click "create app", choose type **script**
3. Copy the client ID (under the app name) and secret

### 3. Backend

```bash
cd backend
npm install
cp .env.example .env
# edit .env with your MONGODB_URI and REDDIT_CLIENT_ID/SECRET
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

### 4. Load the extension in Chrome

1. Go to `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `extension/` folder
5. Pin the ScamShield icon, click it, paste an offer, hit Analyze

## Next steps to extend this (good for portfolio commits)

- Replace regex extraction with a Claude API call that returns structured
  JSON — much more robust on messy real emails.
- Add a domain-age/WHOIS check (free APIs exist) as another scoring signal.
- Add a content script that auto-detects when you're viewing a Gmail message
  and offers to prefill the popup, instead of manual copy-paste.
- Deploy backend to Render/Railway free tier and update `API_BASE` in
  `popup.js` before publishing to the Chrome Web Store.
- Add a "Report this company" button that lets users flag companies
  directly into your Mongo collection, building your own dataset over time.

## Notes on the scoring model

The score is rule-based and additive (see `utils/scorer.js`), not a trained
ML model. This is a deliberate choice: it's fully explainable — you can
show exactly why any offer got flagged, which is both more trustworthy for
users and easier to defend in an interview than a black-box classifier.
