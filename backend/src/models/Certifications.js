import mongoose from "mongoose";
const certificationSchema = new mongoose.Schema(
  {
    provider_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    certificate_name: { type: String, maxlength: 150, required: true },
    issued_by: { type: String, maxlength: 150 },
    issue_date: { type: Date },
    expiry_date: { type: Date },
    document_url: { type: String, maxlength: 255 },
  },
  { timestamps: false }
);

export const Certification = mongoose.model("Certification", certificationSchema);