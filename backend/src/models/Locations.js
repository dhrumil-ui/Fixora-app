import mongoose from "mongoose";

// Reusable GeoJSON Point sub-schema
const pointSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["Point"],
      required: true,
      default: "Point",
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
      validate: {
        validator: (v) => Array.isArray(v) && v.length === 2,
        message: "coordinates must be [longitude, latitude]",
      },
    },
  },
  { _id: false }
);

const locationSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    address_line: { type: String, maxlength: 255 },
    city: { type: String, index: true, maxlength: 100 },
    state: { type: String, maxlength: 100 },
    country: { type: String, maxlength: 100 },
    postal_code: { type: String, maxlength: 20 },

    // A Location must have a valid GeoJSON point — no half-built objects allowed.
    geo: { type: pointSchema, required: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

locationSchema.index({ geo: "2dsphere" });

// Safety net: reject save if geo is malformed instead of letting Mongo throw a 2dsphere error.
locationSchema.pre("save", function (next) {
  const g = this.geo;
  const valid =
    g &&
    g.type === "Point" &&
    Array.isArray(g.coordinates) &&
    g.coordinates.length === 2 &&
    g.coordinates.every((n) => typeof n === "number" && !Number.isNaN(n));
  if (!valid) {
    return next(new Error("Location.geo must be a valid GeoJSON Point with [lng, lat]"));
  }
  next();
});

export const Location = mongoose.model("Location", locationSchema);