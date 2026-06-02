import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    booking_id: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true, unique: true },
    customer_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    provider_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    service_id: { type: mongoose.Schema.Types.ObjectId, ref: "Service", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 1000 },
    is_visible: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Review = mongoose.model("Review", reviewSchema);