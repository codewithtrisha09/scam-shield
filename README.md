# ScamShield

**A full-stack scam-detection platform designed to help students identify suspicious job and internship offers before they become victims.**

ScamShield combines a **Chrome Extension**, **web application**, and **Node.js/Express backend** to analyze job offers and identify common scam indicators such as upfront payment requests, suspicious email domains, missing stipend information, newly registered domains, and lack of a verifiable company presence.

The platform also includes an **AI-powered resume-to-job-description matcher** to help students evaluate how well their resumes align with opportunities they are applying for.

[![Node.js](https://img.shields.io/badge/Node.js-backend-339933?logo=node.js\&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-API-000000?logo=express\&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb\&logoColor=white)](https://www.mongodb.com/atlas)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension%20MV3-4285F4?logo=googlechrome\&logoColor=white)](https://developer.chrome.com/docs/extensions/develop/)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker\&logoColor=white)](https://www.docker.com/)

**Repository:** [github.com/codewithtrisha09/scam-shield](https://github.com/codewithtrisha09/scam-shield)

---

## Why I Built This

Job and internship scams targeting students often follow recognizable patterns: fake HR accounts, free email addresses pretending to represent companies, upfront registration fees, unrealistic offers, and recently created domains.

ScamShield was built to make these warning signs **explicit, explainable, and easier to understand** instead of relying only on intuition.

The project evolved into a full-stack system covering:

* Job offer extraction
* Risk scoring
* Domain-age analysis
* Company verification signals
* Crowdsourced reporting
* AI-assisted extraction
* Resume-to-job matching
* Chrome extension integration
* REST API development
* MongoDB persistence
* Docker containerization
* GitHub Actions CI/CD

---

## Architecture

```text
                         ┌─────────────────────────┐
                         │       ScamShield        │
                         │      User Interface     │
                         └────────────┬────────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    │                                   │
          ┌─────────▼─────────┐              ┌─────────▼─────────┐
          │  Chrome Extension │              │   Web Application │
          │    Manifest V3    │              │    HTML / CSS / JS│
          └─────────┬─────────┘              └─────────┬─────────┘
                    │                                  │
                    └────────────────┬─────────────────┘
                                     │
                              REST API / HTTP
                                     │
                         ┌───────────▼───────────┐
                         │    Node.js + Express  │
                         │        Backend        │
                         └───────────┬───────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              │                      │                      │
      ┌───────▼────────┐    ┌────────▼────────┐    ┌──────▼─────────┐
      │ Scam Analyzer  │    │ Resume Analyzer │    │ Report System  │
      │                │    │                 │    │                │
      │ Extraction     │    │ Gemini API      │    │ User Reports   │
      │ Risk Scoring   │    │ Match Score     │    │ Company Data   │
      └───────┬────────┘    └─────────────────┘    └──────┬─────────┘
              │                                           │
              ├──────────────────┐                        │
              │                  │                        │
      ┌───────▼────────┐  ┌──────▼─────────┐      ┌──────▼─────────┐
      │ Domain / RDAP  │  │ LinkedIn Check │      │ MongoDB Atlas  │
      │ Domain Age     │  │ Google Search  │      │                │
      └────────────────┘  └────────────────┘      │ Reports        │
                                                  │ Companies      │
                                                  └────────────────┘
```

---

## How It Works

1. The user pastes a job or internship offer into the Chrome Extension or website.
2. The offer is sent to the backend through `POST /api/analyze`.
3. The backend extracts important information such as:

   * Company name
   * Job role
   * Stipend
   * Email domain
   * Suspicious phrases
4. Regex-based extraction is performed first.
5. If important fields are missing, Gemini can perform a second structured extraction pass.
6. Additional signals are checked, including:

   * Domain registration age
   * Crowdsourced company reports
   * Reddit mentions
   * LinkedIn/company presence
7. `scorer.js` combines the signals into an explainable **0–100 risk score**.
8. The frontend displays:

   * Overall risk score
   * Extracted information
   * Individual red flags
   * Company mentions
   * Reporting options
9. Users can also submit reports about suspicious companies.
10. The resume analyzer compares a resume against a job description and provides a match score, missing skills, and suggestions.

---

## Features

### 1. Scam Offer Analyzer

Analyzes job and internship offers for common scam indicators.

The system can identify:

* Upfront payment or registration fee requests
* Suspicious email addresses
* Missing stipend information
* Unrealistic compensation
* Suspicious phrases
* Recently registered domains
* Missing company presence
* Existing user reports

The final result is an explainable risk score rather than a black-box prediction.

### 2. AI Extraction Fallback

The primary extraction system uses regular expressions.

When important information is missing, Gemini can perform a second structured extraction pass through:

```text
utils/llmExtractor.js
```

If the Gemini API key is not configured, the application continues using the regex-based extraction system.

### 3. Resume Analyzer

ScamShield includes an AI-powered resume matching tool.

The endpoint:

```text
POST /api/analyze-resume
```

accepts:

```json
{
  "resumeText": "...",
  "jobDescriptionText": "..."
}
```

The analyzer returns:

* Resume-to-job match score
* Matched skills
* Missing skills
* Improvement suggestions

### 4. User-Submitted Reports

Users can report suspicious companies directly from the results screen.

Reports are stored in MongoDB and can contribute to the risk score as an independent signal.

### 5. Domain Age Detection

ScamShield uses the free RDAP service to check domain registration information.

A recently registered domain can be a useful warning signal when combined with other suspicious indicators.

### 6. LinkedIn Presence Check

The application can optionally use Google Custom Search to check whether a company has a discoverable LinkedIn presence.

This is an optional signal and does not prevent the rest of the analysis from running if the service is unavailable.

### 7. Chrome Extension

The Chrome Extension uses **Manifest V3** and provides a convenient interface for analyzing job offers directly from the browser.

Users can:

1. Open the extension.
2. Paste an offer.
3. Click **Analyze**.
4. View the risk score.
5. Review individual findings.
6. Report the company if necessary.

### 8. Docker Support

The backend includes Docker support for consistent local development and deployment environments.

### 9. CI/CD

GitHub Actions is configured to:

1. Install dependencies.
2. Perform JavaScript syntax checks.
3. Build the Docker image.
4. Push the image to GitHub Container Registry.
5. Optionally trigger deployment when a deployment environment is configured.

---

## Project Structure

```text
scam-shield/
│
├── extension/
│   ├── manifest.json
│   ├── popup.html
│   ├── popup.css
│   ├── popup.js
│   ├── background.js
│   └── icons/
│
├── website/
│   ├── index.html
│   └── docs.html
│
├── backend/
│   ├── server.js
│   │
│   ├── routes/
│   │   ├── analyze.js
│   │   ├── report.js
│   │   └── resumeAnalyze.js
│   │
│   ├── utils/
│   │   ├── extractor.js
│   │   ├── scorer.js
│   │   ├── llmExtractor.js
│   │   ├── llmExtractor.claude.js
│   │   ├── resumeAnalyzer.js
│   │   ├── domainAge.js
│   │   ├── linkedinCheck.js
│   │   ├── redditSearch.js
│   │   └── redditSearch.live.js
│   │
│   ├── models/
│   │   ├── Company.js
│   │   └── Report.js
│   │
│   ├── Dockerfile
│   └── .dockerignore
│
├── docker-compose.yml
├── .github/
│   └── workflows/
│       └── ci-cd.yml
│
└── README.md
```

---

## Tech Stack

### Frontend

* HTML5
* CSS3
* JavaScript
* Chrome Extension Manifest V3

### Backend

* Node.js
* Express.js
* REST API

### Database

* MongoDB
* MongoDB Atlas

### AI

* Google Gemini API

### External Services

* RDAP
* Google Custom Search
* Reddit API integration

### DevOps

* Docker
* Docker Compose
* GitHub Actions
* GitHub Container Registry

---

## Environment Variables

Only `MONGODB_URI` is required for the core backend.

| Variable                  | Required | Purpose                           |
| ------------------------- | -------- | --------------------------------- |
| `MONGODB_URI`             | Yes      | MongoDB connection                |
| `GEMINI_API_KEY`          | No       | AI extraction and resume analysis |
| `GOOGLE_SEARCH_API_KEY`   | No       | LinkedIn/company search           |
| `GOOGLE_SEARCH_ENGINE_ID` | No       | Google Custom Search              |

Example:

```env
MONGODB_URI=your_mongodb_connection_string
GEMINI_API_KEY=your_gemini_api_key
GOOGLE_SEARCH_API_KEY=your_google_search_api_key
GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id
```

> **Security:** Never commit `.env` files, API keys, database credentials, or other secrets to GitHub.

If a real credential has ever been exposed publicly, regenerate it before publishing the repository.

---

## Setup

### 1. Clone the Repository

```bash
git clone https://github.com/codewithtrisha09/scam-shield.git
```

### 2. Navigate to the Backend

```bash
cd scam-shield/backend
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Create the Environment File

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Add your environment variables to `.env`.

### 5. Start the Backend

```bash
npm run dev
```

The API will run locally on:

```text
http://localhost:5000
```

---

## Test the API

Example request:

```bash
curl -X POST http://localhost:5000/api/analyze \
  -H "Content-Type: application/json" \
  -d "{\"text\":\"Company: BrightFuture Info Pvt Ltd. Role: Data Entry Intern. Stipend: 45000 per month. Please pay a refundable registration fee of 1500 to confirm your seat. Contact: hr.brightfuture@gmail.com\"}"
```

---

## Load the Chrome Extension

1. Open Chrome.
2. Navigate to:

```text
chrome://extensions
```

3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the `extension/` folder.
6. Pin the ScamShield extension.
7. Paste a job offer.
8. Click **Analyze**.
9. Review the risk score and findings.

---

## Running with Docker

### Option A — Docker Compose

```bash
docker compose up
```

### Option B — Build Manually

```bash
cd backend
docker build -t scamshield-backend .
```

Then:

```bash
docker run -p 5000:5000 --env-file .env scamshield-backend
```

---

## Reddit Data Layer

The current Reddit search layer uses deterministic mock data so the application can demonstrate the complete analysis pipeline without depending on Reddit API approval.

The live implementation is preserved separately in:

```text
utils/redditSearch.live.js
```

Once Reddit API access is available, the mock implementation can be replaced without changing the main analysis pipeline.

---

## Scoring Model

ScamShield currently uses a **rule-based additive scoring system**, not a trained machine-learning classifier.

The scoring system combines multiple signals to produce a risk score from:

```text
0 → 100
```

The purpose of this approach is explainability.

Instead of simply saying:

> "This job is a scam."

ScamShield can explain **why** an offer received a particular risk score.

Potential risk signals include:

* Upfront payment requests
* Suspicious email domains
* Recently registered domains
* Missing company information
* Existing user reports
* Suspicious wording

---

## Rate Limiting

The API uses `express-rate-limit` to limit requests and protect external API quotas.

The current configuration applies a shared limit of:

```text
20 requests per 15 minutes per IP
```

---

## Limitations

ScamShield is designed as a **decision-support tool**, not a definitive scam detector.

A high risk score does not automatically prove that an opportunity is fraudulent, and a low score does not guarantee that an opportunity is legitimate.

External services can also change availability or API policies. Optional integrations are therefore designed to fail gracefully where possible.

The Reddit layer currently uses mock data until live API access is available.

The CI/CD pipeline currently performs syntax checks and Docker builds but does not yet include a comprehensive automated test suite.

---

## Future Improvements

* Live Reddit integration
* Automated unit and integration tests
* Browser content script for automatic job-offer detection
* Gmail integration for analyzing suspicious recruitment emails
* Improved company verification
* Machine-learning-based risk classification
* Historical risk tracking for companies
* User accounts and personalized scam history
* Real-time notifications for reported companies
* Improved accessibility
* Production deployment
* Monitoring and analytics

---

## Roadmap

```text
[x] Chrome Extension
[x] Job Offer Analyzer
[x] Rule-Based Risk Scoring
[x] MongoDB Integration
[x] User Company Reports
[x] Domain Age Detection
[x] AI Extraction Fallback
[x] Resume Analyzer
[x] Docker Support
[x] GitHub Actions CI/CD
[ ] Automated Test Suite
[ ] Live Reddit Integration
[ ] Browser-Based Auto Detection
[ ] Gmail Integration
[ ] Machine Learning Risk Model
[ ] Production Deployment
```

---

## Disclaimer

ScamShield is an educational and decision-support project.

The risk score and analysis should not be treated as definitive proof that a company, recruiter, job, or internship is fraudulent.

Users should independently verify companies and opportunities through official sources before sharing personal information, making payments, signing agreements, or accepting offers.

---

## License

No license has been added yet. This is currently a personal/portfolio project.

---

## Author

**Trisha Shetty**

B.Tech CSE (AI & ML)

Building technology-driven solutions at the intersection of **AI, cybersecurity, software engineering, and student safety**.

[GitHub](https://github.com/codewithtrisha09)
