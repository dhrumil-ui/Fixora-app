import mongoose from "mongoose";

/* ----------------------------- Reusable GeoJSON ----------------------------- */
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

/* ------------------------------ Sub-schemas -------------------------------- */
const providerDocumentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["id_front", "id_back", "address_proof", "other"],
      required: true,
    },
    url: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    uploaded_at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const savedAddressSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true },
    address_text: { type: String, trim: true },
    formatted_address: { type: String, trim: true },
    geo: { type: pointSchema, default: undefined }, // stays absent until set
    is_primary: { type: Boolean, default: false },
    created_at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const providerProfileSchema = new mongoose.Schema(
  {
    phone: { type: String, trim: true },
    photo_url: { type: String, trim: true },
    address_line1: { type: String, trim: true },
    address_line2: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    zip: { type: String, trim: true },
    service_radius_miles: { type: Number, default: 10 },
    title: { type: String, trim: true },
    bio: { type: String, trim: true, maxlength: 1000 },
    experience_years: { type: Number, default: 0 },
    categories: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],
    ssn_last4: { type: String, trim: true, minlength: 4, maxlength: 4 },
    documents: { type: [providerDocumentSchema], default: [] },
    is_available: { type: Boolean, default: true },

    home_geo: { type: pointSchema, default: undefined },
    formatted_address: { type: String, trim: true },

    live_geo: { type: pointSchema, default: undefined },
    is_live_now: { type: Boolean, default: false },
    live_updated_at: { type: Date, default: null },

    max_travel_miles: { type: Number, default: 25 },
    avg_response_minutes: { type: Number, default: null },
    reliability_score: { type: Number, default: null },
  },
  { _id: false }
);

/* --------------------------------- User ------------------------------------ */
const userSchema = new mongoose.Schema(
  {
    full_name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    password_hash: { type: String, required: true },
    role: { type: String, enum: ["customer", "provider", "admin"], required: true },
    is_active: { type: Boolean, default: true },
    deactivated_at: { type: Date, default: null },
    is_email_verified: { type: Boolean, default: false },
    reset_password_token_hash: { type: String, default: null },
    reset_password_expires_at: { type: Date, default: null },
    email_verify_token_hash: { type: String },
    email_verify_expires_at: { type: Date },
    is_profile_complete: { type: Boolean, default: false },
    has_created_service: { type: Boolean, default: false },
    rating_avg: { type: Number, default: 0 },
    rating_count: { type: Number, default: 0 },

    saved_addresses: { type: [savedAddressSchema], default: [] },

    favorite_providers: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },

    provider_status: {
      type: String,
      enum: ["draft", "pending", "pending_verification", "verified", "rejected"],
      default: "draft",
    },

    // Keep auto-created so existing app code that reads user.provider_profile
    // still works. The fix is that the geo subdocs inside no longer auto-materialize.
    provider_profile: {
      type: providerProfileSchema,
      default: () => ({}),
    },

    availability: {
      days: {
        type: [String],
        enum: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        default: ["Mon", "Tue", "Wed", "Thu", "Fri"],
      },
      start_time: { type: String, default: "09:00" },
      end_time: { type: String, default: "18:00" },
    },

    cashback_balance: { type: Number, default: 0, min: 0 },
    cashback_total_earned: { type: Number, default: 0, min: 0 },
    cashback_total_spent: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

/* --------------------------------- Indexes --------------------------------- */
userSchema.index({ "provider_profile.home_geo": "2dsphere" }, { sparse: true });
userSchema.index({ "provider_profile.live_geo": "2dsphere" }, { sparse: true });
userSchema.index({ "saved_addresses.geo": "2dsphere" }, { sparse: true });

/* ----------------------- Safety net before saving -------------------------- */
userSchema.pre("save", function () {
  const isValidPoint = (p) =>
    p &&
    p.type === "Point" &&
    Array.isArray(p.coordinates) &&
    p.coordinates.length === 2 &&
    p.coordinates.every((n) => typeof n === "number" && !Number.isNaN(n));

  const pp = this.provider_profile;
  if (pp) {
    if (pp.home_geo && !isValidPoint(pp.home_geo)) pp.home_geo = undefined;
    if (pp.live_geo && !isValidPoint(pp.live_geo)) pp.live_geo = undefined;
  }

  if (Array.isArray(this.saved_addresses)) {
    this.saved_addresses.forEach((addr) => {
      if (addr.geo && !isValidPoint(addr.geo)) addr.geo = undefined;
    });
  }
});

export const User = mongoose.model("User", userSchema);