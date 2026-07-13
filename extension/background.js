// Manifest V3 service worker.
// Currently unused, but this is where you'd add things like:
// - a right-click context menu ("Analyze this with ScamShield")
// - listening for messages from content scripts if you later add
//   auto-detection of job emails inside Gmail/Outlook tabs

chrome.runtime.onInstalled.addListener(() => {
  console.log("ScamShield installed.");
});
