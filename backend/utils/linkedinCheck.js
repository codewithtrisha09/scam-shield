import fetch from "node-fetch";

// Checks whether a company has a real, findable LinkedIn company page.
// Uses Google's Custom Search JSON API (free tier: 100 queries/day) rather
// than scraping LinkedIn directly, which violates their ToS.
//
// Setup required (both optional - gracefully skipped if not configured):
// 1. https://console.cloud.google.com/apis/credentials -> create an API key,
//    enable "Custom Search API" for your project
// 2. https://programmablesearchengine.google.com -> create a search engine,
//    set it to search the entire web, copy its Search Engine ID (cx)

export async function checkLinkedInPresence(companyName) {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

  if (!apiKey || !searchEngineId || !companyName) {
    return { checked: false, found: false, url: null };
  }

  try {
    const query = encodeURIComponent(`"${companyName}" site:linkedin.com/company`);
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${query}&num=3`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Google Search API responded ${res.status}`);

    const data = await res.json();
    const items = data.items || [];

    // Loose match: does any result's title/snippet actually contain the
    // company name, rather than just any linkedin.com/company page?
    const nameLower = companyName.toLowerCase();
    const match = items.find(
      (item) =>
        item.title?.toLowerCase().includes(nameLower) ||
        item.snippet?.toLowerCase().includes(nameLower)
    );

    return {
      checked: true,
      found: Boolean(match),
      url: match?.link || null,
    };
  } catch (err) {
    console.error("LinkedIn presence check failed:", err.message);
    return { checked: false, found: false, url: null }; // fail gracefully
  }
}
