import fetch from "node-fetch";

let cachedToken = null;
let tokenExpiresAt = 0;

// Reddit's "app-only" OAuth flow - no user login needed, just your app's
// client id/secret from https://www.reddit.com/prefs/apps (choose "script" type)
async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;

  const auth = Buffer.from(
    `${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "ScamShield/1.0 (student job-scam checker)",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    throw new Error(`Reddit auth failed: ${res.status}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

// Searches Reddit for posts mentioning the company alongside scam-related keywords.
export async function searchRedditForCompany(companyName) {
  if (!companyName) return [];

  try {
    const token = await getAccessToken();
    const query = encodeURIComponent(`"${companyName}" (scam OR fraud OR fake OR "did not pay")`);

    const res = await fetch(
      `https://oauth.reddit.com/search?q=${query}&limit=5&sort=relevance`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "User-Agent": "ScamShield/1.0 (student job-scam checker)",
        },
      }
    );

    if (!res.ok) throw new Error(`Reddit search failed: ${res.status}`);

    const data = await res.json();
    return (data.data?.children || []).map((post) => ({
      title: post.data.title,
      url: `https://reddit.com${post.data.permalink}`,
      source: "reddit",
      score: post.data.score,
    }));
  } catch (err) {
    console.error("Reddit search error:", err.message);
    return []; // fail gracefully - don't break the whole analysis if Reddit is down
  }
}
