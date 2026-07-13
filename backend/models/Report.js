import mongoose from "mongoose";

// Separate from Company.js (which caches Reddit mentions) - this collection
// stores reports submitted directly by users of the extension, building an
// independent, crowdsourced signal over time instead of relying only on Reddit.
const reportSchema = new mongoose.Schema({
  companyName: { type: String, required: true },
  normalizedName: { type: String, required: true, index: true },
  reason: { type: String, required: true, maxlength: 500 },
  reportedAt: { type: Date, default: Date.now },
});

export default mongoose.model("Report", reportSchema);
