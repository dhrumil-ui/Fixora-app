import mongoose from "mongoose";
const availabilitySchema = new mongoose.Schema(
  {
    provider_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    day_of_week: { type: String, enum: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], index: true },
    start_time: { type: String }, // "HH:mm"
    end_time: { type: String },   // "HH:mm"
    is_available: { type: Boolean, default: true },
  },
  { timestamps: false }
);

export const Availability = mongoose.model("Availability", availabilitySchema);