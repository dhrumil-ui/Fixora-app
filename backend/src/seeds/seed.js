import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import { User } from "../models/Users.js";
import { Category } from "../models/Categories.js";
import { Service } from "../models/Services.js";
import { ProviderProfile } from "../models/Provider_profile.js";
import { ProviderService } from "../models/Provide_services.js";
import { Availability } from "../models/Availability.js";
import { Location } from "../models/Locations.js";
import { Booking } from "../models/Booking.js";
import { Payment } from "../models/Payment.js";
import { Review } from "../models/Reviews.js";
import { Certification } from "../models/Certifications.js";
import bcrypt from "bcryptjs";

dotenv.config();

export default async function seedAdmin() {
  try {
    const email = process.env.ADMIN_EMAIL || "admin@fixora.com";
    const password = process.env.ADMIN_PASSWORD || "Fixora@12345";

    const existing = await User.findOne({ email });
    if (existing) {
      console.log("✅ Admin already exists:", email);
      return existing;
    }

    const password_hash = await bcrypt.hash(password, 10);

    const admin = await User.create({
      full_name: "Fixora Admin",
      email,
      phone: "9000000000",
      password_hash,
      role: "admin",
      is_active: true,
      is_email_verified: true,
      is_profile_complete: true,
    });

    console.log("✅ Admin seeded:", email);
    return admin;
  } catch (e) {
    console.error("❌ Seed error:", e.message);
  }
}

async function seed() {
  await connectDB();

  await Promise.all([
    User.deleteMany({}),
    Category.deleteMany({}),
    Service.deleteMany({}),
    ProviderProfile.deleteMany({}),
    ProviderService.deleteMany({}),
    Availability.deleteMany({}),
    Location.deleteMany({}),
    Booking.deleteMany({}),
    Payment.deleteMany({}),
    Review.deleteMany({}),
    Certification.deleteMany({}),
  ]);

  const admin = await seedAdmin();

  const customerPasswordHash = await bcrypt.hash("Customer@123", 10);
  const providerPasswordHash = await bcrypt.hash("Provider@123", 10);

  const [customer1, customer2, provider1, provider2, provider3] =
    await User.insertMany([
      {
        full_name: "Amit Patel",
        email: "amit@fixora.com",
        phone: "9000000001",
        password_hash: customerPasswordHash,
        role: "customer",
        is_active: true,
      },
      {
        full_name: "Neha Shah",
        email: "neha@fixora.com",
        phone: "9000000002",
        password_hash: customerPasswordHash,
        role: "customer",
        is_active: true,
      },
      {
        full_name: "John Smith",
        email: "john@fixora.com",
        phone: "9000000101",
        password_hash: providerPasswordHash,
        role: "provider",
        is_active: true,
        profile_image: "JS",
        is_profile_complete: true,
        provider_status: "verified",
      },
      {
        full_name: "Sarah Johnson",
        email: "sarah@fixora.com",
        phone: "9000000102",
        password_hash: providerPasswordHash,
        role: "provider",
        is_active: true,
        profile_image: "SJ",
        is_profile_complete: true,
        provider_status: "verified",
      },
      {
        full_name: "Michael Chen",
        email: "michael@fixora.com",
        phone: "9000000103",
        password_hash: providerPasswordHash,
        role: "provider",
        is_active: true,
        profile_image: "MC",
        is_profile_complete: true,
        provider_status: "verified",
      },
    ]);

  await ProviderProfile.insertMany([
    {
      provider_id: provider1._id,
      bio: "Expert plumber for leak fixes and drain cleaning.",
      experience_years: 8,
      base_price: 50,
      rating_avg: 4.9,
      total_reviews: 127,
      is_verified: true,
      available_status: true,
    },
    {
      provider_id: provider2._id,
      bio: "Certified electrician, safe and quick installations.",
      experience_years: 6,
      base_price: 60,
      rating_avg: 4.8,
      total_reviews: 98,
      is_verified: true,
      available_status: true,
    },
    {
      provider_id: provider3._id,
      bio: "Professional cleaner for deep clean and kitchen clean.",
      experience_years: 10,
      base_price: 40,
      rating_avg: 5.0,
      total_reviews: 215,
      is_verified: true,
      available_status: true,
    },
  ]);

  const categories = await Category.insertMany([
    { category_name: "Plumbing", icon: "plumbing" },
    { category_name: "Electrical", icon: "electrical" },
    { category_name: "Cleaning", icon: "cleaning" },
    { category_name: "Appliance Repair", icon: "appliance" },
    { category_name: "Handyman", icon: "handyman" },
  ]);

  const catByName = Object.fromEntries(
    categories.map((c) => [c.category_name, c._id])
  );

  const services = await Service.insertMany([
    {
      provider_id: provider1._id,
      category_id: catByName["Plumbing"],
      service_name: "Leak Fix",
      description: "Fix leaking pipes, taps, joints",
      price: 55,
      is_active: true,
    },
    {
      provider_id: provider1._id,
      category_id: catByName["Plumbing"],
      service_name: "Drain Cleaning",
      description: "Unclog sinks and drains",
      price: 60,
      is_active: true,
    },

    {
      provider_id: provider2._id,
      category_id: catByName["Electrical"],
      service_name: "Switch/Socket Repair",
      description: "Repair switches/sockets",
      price: 65,
      is_active: true,
    },
    {
      provider_id: provider2._id,
      category_id: catByName["Electrical"],
      service_name: "Fan/Light Installation",
      description: "Install fan/light safely",
      price: 75,
      is_active: true,
    },

    {
      provider_id: provider3._id,
      category_id: catByName["Cleaning"],
      service_name: "Home Deep Cleaning",
      description: "Full house deep cleaning",
      price: 45,
      is_active: true,
    },
    {
      provider_id: provider3._id,
      category_id: catByName["Cleaning"],
      service_name: "Kitchen Cleaning",
      description: "Kitchen + appliance cleaning",
      price: 40,
      is_active: true,
    },
  ]);

  const serviceByKey = Object.fromEntries(
    services.map((s) => [`${s.provider_id.toString()}|${s.service_name}`, s._id])
  );

  // const serviceByName = Object.fromEntries(services.map((s) => [s.service_name, s._id]));

  await Availability.insertMany([
    {
      provider_id: provider1._id,
      day_of_week: "Mon",
      start_time: "09:00",
      end_time: "18:00",
      is_available: true,
    },
    {
      provider_id: provider1._id,
      day_of_week: "Tue",
      start_time: "09:00",
      end_time: "18:00",
      is_available: true,
    },
    {
      provider_id: provider2._id,
      day_of_week: "Wed",
      start_time: "10:00",
      end_time: "19:00",
      is_available: true,
    },
    {
      provider_id: provider2._id,
      day_of_week: "Thu",
      start_time: "10:00",
      end_time: "19:00",
      is_available: true,
    },
    {
      provider_id: provider3._id,
      day_of_week: "Fri",
      start_time: "08:00",
      end_time: "16:00",
      is_available: true,
    },
    {
      provider_id: provider3._id,
      day_of_week: "Sat",
      start_time: "09:00",
      end_time: "15:00",
      is_available: true,
    },
  ]);

  await Location.insertMany([
    {
      user_id: customer1._id,
      address_line: "123 Main St",
      city: "Camden",
      state: "NJ",
      country: "USA",
      postal_code: "08102",
      geo: { type: "Point", coordinates: [-75.1196, 39.9259] },
    },
    {
      user_id: customer2._id,
      address_line: "44 Market St",
      city: "Philadelphia",
      state: "PA",
      country: "USA",
      postal_code: "19106",
      geo: { type: "Point", coordinates: [-75.144, 39.9489] },
    },
    {
      user_id: provider1._id,
      address_line: "10 Water St",
      city: "Camden",
      state: "NJ",
      country: "USA",
      postal_code: "08103",
      geo: { type: "Point", coordinates: [-75.11, 39.94] },
    },
    {
      user_id: provider2._id,
      address_line: "55 Broad St",
      city: "Philadelphia",
      state: "PA",
      country: "USA",
      postal_code: "19107",
      geo: { type: "Point", coordinates: [-75.16, 39.95] },
    },
    {
      user_id: provider3._id,
      address_line: "77 Walnut St",
      city: "Camden",
      state: "NJ",
      country: "USA",
      postal_code: "08104",
      geo: { type: "Point", coordinates: [-75.13, 39.92] },
    },
  ]);

  // const [sLeakFix, sDeepClean] = [
  //   services.find((s) => s.service_name === "Leak Fix"),
  //   services.find((s) => s.service_name === "Home Deep Cleaning"),
  // ];

  const [b1, b2] = await Booking.insertMany([
    {
      customer_id: customer1._id,
      provider_id: provider1._id,
      service_id: serviceByKey[`${provider1._id.toString()}|Leak Fix`],
      date: new Date().toISOString().slice(0, 10),
      time: "11:00",
      total_amount: 140,
      status: "confirmed",
      address: "123 Main St, Camden, NJ 08102",
    },
    {
      customer_id: customer2._id,
      provider_id: provider3._id,
      service_id: serviceByKey[`${provider3._id.toString()}|Home Deep Cleaning`],
      date: new Date().toISOString().slice(0, 10),
      time: "15:00",
      total_amount: 120,
      status: "completed",
      address: "44 Market St, Philadelphia, PA 19106",
    },
  ]);

  await Payment.insertMany([
    {
      booking_id: b1._id,
      amount: 140,
      payment_method: "card",
      payment_status: "paid",
      transaction_ref: "TXN_FIXORA_10001",
      paid_at: new Date(),
    },
    {
      booking_id: b2._id,
      amount: 120,
      payment_method: "wallet",
      payment_status: "paid",
      transaction_ref: "TXN_FIXORA_10002",
      paid_at: new Date(),
    },
  ]);

  await Review.insertMany([
    {
      booking_id: b2._id,
      customer_id: customer2._id,
      provider_id: provider3._id,
      rating: 5,
      comment: "Very professional and super clean work!",
    },
  ]);

  await Certification.insertMany([
    {
      provider_id: provider1._id,
      certificate_name: "Licensed Plumber",
      issued_by: "NJ Trade Board",
      issue_date: new Date("2020-03-01"),
      expiry_date: new Date("2027-03-01"),
      document_url: "https://example.com/plumber-license.pdf",
    },
    {
      provider_id: provider2._id,
      certificate_name: "Electrical Safety Certificate",
      issued_by: "PA Electrical Authority",
      issue_date: new Date("2021-06-10"),
      expiry_date: new Date("2026-06-10"),
      document_url: "https://example.com/electrical-certificate.pdf",
    },
  ]);

  console.log("✅ Seed completed!");
  console.log("Admin:", admin.email);
  console.log("Providers:", provider1.email, provider2.email, provider3.email);
  console.log("Customers:", customer1.email, customer2.email);

  await mongoose.connection.close();
  process.exit(0);
}

if (process.argv[1].includes('seed')) {
  seed().catch(async (err) => {
    console.error("Seed failed:", err);
    try { await mongoose.connection.close(); } catch (err) {
      console.error("Seed error:", err);
    }
    process.exit(1);
  });
}
