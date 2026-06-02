import mongoose from "mongoose";
const providerServiceSchema = new mongoose.Schema(
  {
    provider_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    service_id: { type: mongoose.Schema.Types.ObjectId, ref: "Service", required: true, index: true },
    price_per_hour: { type: Number, min: 0 },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

// prevent duplicate mapping of same provider+service
providerServiceSchema.index({ provider_id: 1, service_id: 1 }, { unique: true });

export const ProviderService = mongoose.model("ProviderService", providerServiceSchema);