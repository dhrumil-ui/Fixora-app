import mongoose from "mongoose";
import dotenv from "dotenv";
import { User } from "../models/Users.js";
import { geocodeAddress } from "../utils/geocode.js";

dotenv.config();

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const providers = await User.find({
        role: "provider",
        "provider_profile.address_line1": { $exists: true, $ne: "" },
        $or: [
            { "provider_profile.home_geo": { $exists: false } },
            { "provider_profile.home_geo.coordinates": { $exists: false } },
        ],
    });

    console.log(`Found ${providers.length} providers to geocode\n`);

    let success = 0;
    let failed = 0;

    for (const p of providers) {
        const fullAddress = [
            p.provider_profile.address_line1,
            p.provider_profile.city,
            p.provider_profile.state,
            p.provider_profile.zip,
        ]
            .filter(Boolean)
            .join(", ");

        console.log(`Geocoding: ${p.email} → ${fullAddress}`);

        const geo = await geocodeAddress(fullAddress);
        if (geo) {
            p.provider_profile.home_geo = {
                type: "Point",
                coordinates: [geo.lng, geo.lat],
            };
            p.provider_profile.formatted_address = geo.formatted_address;
            if (!p.provider_profile.max_travel_miles) {
                p.provider_profile.max_travel_miles = 25;
            }
            await p.save();
            console.log(`  ✅ [${geo.lng}, ${geo.lat}]\n`);
            success++;
        } else {
            console.log(`  ❌ Failed\n`);
            failed++;
        }

        // Rate limit: 100ms between calls (Google free tier safe)
        await new Promise((r) => setTimeout(r, 100));
    }

    console.log(`\n=== Done ===`);
    console.log(`✅ Success: ${success}`);
    console.log(`❌ Failed:  ${failed}`);

    await mongoose.disconnect();
    process.exit(0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});