import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    category_name: { type: String, required: true, unique: true, trim: true },
    icon: { type: String, trim: true },
    is_active: { type: Boolean, default: true },
    min_price: { type: Number, default: 0 },
    max_price: { type: Number, default: 9999 },
    allowed_pricing_types: {
      type: [String],
      enum: ["hourly", "fixed"],
      default: ["hourly", "fixed"],
    },
  },
  { timestamps: true }
);

export const Category = mongoose.model("Category", categorySchema);