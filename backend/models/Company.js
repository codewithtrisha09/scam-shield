import mongoose from "mongoose";

// We cache companies we've already searched so repeated checks
// (many students often paste offers from the same shady "company")
// don't re-hit the Reddit API every single time.
const mentionSchema = new mongoose.Schema(
  {
    title: String,
    url: String,
    source: String, // "reddit", "news", etc.
  },
  { _id: false }
);

const companySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, index: true },
  normalizedName: { type: String, required: true, index: true }, // lowercased, trimmed - used for lookups
  mentions: [mentionSchema],
  scamMentionCount: { type: Number, default: 0 },
  lastCheckedAt: { type: Date, default: Date.now },
});

// Cache entries older than 7 days are considered stale and re-fetched
companySchema.methods.isStale = function () {
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  return Date.now() - this.lastCheckedAt.getTime() > sevenDays;
};

export default mongoose.model("Company", companySchema);
