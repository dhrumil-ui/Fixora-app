import mongoose from "mongoose";

export async function connectDB() {
  const mongoUri =
    process.env.MONGO_URI ||
    process.env.MONGO_URL ||
    process.env.MONGO_CONNECTION_STRING;

  const dbName = process.env.MONGO_DB || "serviceProvider";

  if (!mongoUri) throw new Error("MONGO_URI missing in .env");

  await mongoose.connect(mongoUri, { dbName });
  console.log(`✅ MongoDB connected (${dbName})`);
}