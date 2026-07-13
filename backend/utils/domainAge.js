import fetch from "node-fetch";

// RDAP (Registration Data Access Protocol) is the modern replacement for
// WHOIS, and rdap.org provides a free public gateway that routes to the
// correct registry - no API key needed.
//
// Domain age is a strong scam signal: legitimate companies' domains are
// usually years old, while scam sites are often registered days or weeks
// before they start emailing "offers."

export async function checkDomainAge(emailDomain) {
  if (!emailDomain) return { checked: false, ageDays: null, registeredOn: null };

  try {
    const res = await fetch(`https://rdap.org/domain/${emailDomain}`);
    if (!res.ok) {
      // Common for free-mail domains (gmail.com etc.) or unregistered/invalid
      // domains - not an error worth surfacing, just means we can't check age.
      return { checked: false, ageDays: null, registeredOn: null };
    }

    const data = await res.json();
    const registrationEvent = (data.events || []).find(
      (e) => e.eventAction === "registration"
    );

    if (!registrationEvent) {
      return { checked: false, ageDays: null, registeredOn: null };
    }

    const registeredOn = new Date(registrationEvent.eventDate);
    const ageDays = Math.floor((Date.now() - registeredOn.getTime()) / (1000 * 60 * 60 * 24));

    return { checked: true, ageDays, registeredOn: registeredOn.toISOString().split("T")[0] };
  } catch (err) {
    console.error("Domain age check failed:", err.message);
    return { checked: false, ageDays: null, registeredOn: null }; // fail gracefully
  }
}
