import mongoose from "mongoose";
const providerProfileSchema = new mongoose.Schema(
  {
    provider_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true, required: true },
    bio: { type: String },
    experience_years: { type: Number, min: 0 },
    base_price: { type: Number, min: 0 },
    rating_avg: { type: Number, default: 0, index: true },
    total_reviews: { type: Number, default: 0 },
    is_verified: { type: Boolean, default: false, index: true },
    available_status: { type: Boolean, default: true, index: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

export const ProviderProfile = mongoose.model("ProviderProfile", providerProfileSchema);