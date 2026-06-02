import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import { User } from "../models/Users.js";
import { Service } from "../models/Services.js";
import { Category } from "../models/Categories.js";
import { Booking } from "../models/Booking.js";
import { Review } from "../models/Reviews.js";
import { geocodeAddress } from "../utils/geocode.js";

dotenv.config();

const PROVIDERS = [
    {
        full_name: "Raj Patel",
        email: "raj.plumber@fixora-demo.com",
        phone: "+1-732-555-0101",
        address_line1: "245 Oak Tree Rd",
        city: "Edison",
        state: "NJ",
        zip: "08820",
        bio: "Licensed master plumber with 12 years of experience. Specializing in emergency repairs, pipe installation, and water heater services. Available 24/7 for urgent calls.",
        experience_years: 12,
        max_travel_miles: 30,
        category_name: "Plumbing",
        services: [
            { name: "Emergency Plumbing", price: 150, pricing_type: "fixed" },
            { name: "Drain Cleaning", price: 120, pricing_type: "fixed" },
            { name: "Water Heater Install", price: 85, pricing_type: "hourly" },
        ],
        rating_avg: 4.8,
        rating_count: 47,
    },
    {
        full_name: "Maria Rodriguez",
        email: "maria.cleaning@fixora-demo.com",
        phone: "+1-732-555-0102",
        address_line1: "1450 Route 27",
        city: "New Brunswick",
        state: "NJ",
        zip: "08901",
        bio: "Professional cleaning service with eco-friendly products. Specializing in deep cleaning, move-in/move-out, and post-construction cleanup. Bonded and insured.",
        experience_years: 8,
        max_travel_miles: 25,
        category_name: "Cleaning",
        services: [
            { name: "Deep House Cleaning", price: 200, pricing_type: "fixed" },
            { name: "Office Cleaning", price: 60, pricing_type: "hourly" },
            { name: "Move-Out Cleaning", price: 250, pricing_type: "fixed" },
        ],
        rating_avg: 4.9,
        rating_count: 82,
    },
    {
        full_name: "James O'Brien",
        email: "james.electrician@fixora-demo.com",
        phone: "+1-609-555-0103",
        address_line1: "78 State Street",
        city: "Trenton",
        state: "NJ",
        zip: "08608",
        bio: "Master electrician serving central NJ. Specializing in panel upgrades, EV charger installation, and home rewiring. NJ licensed and OSHA certified.",
        experience_years: 15,
        max_travel_miles: 35,
        category_name: "Electrical",
        services: [
            { name: "Electrical Panel Upgrade", price: 1200, pricing_type: "fixed" },
            { name: "EV Charger Installation", price: 600, pricing_type: "fixed" },
            { name: "Hourly Electrical Work", price: 95, pricing_type: "hourly" },
        ],
        rating_avg: 4.7,
        rating_count: 35,
    },
    {
        full_name: "Sarah Chen",
        email: "sarah.handyman@fixora-demo.com",
        phone: "+1-732-555-0104",
        address_line1: "55 Westfield Ave",
        city: "Westfield",
        state: "NJ",
        zip: "07090",
        bio: "Reliable handyman services for all your home repair needs. From hanging pictures to small carpentry projects, I do it all. Same-day service available.",
        experience_years: 6,
        max_travel_miles: 20,
        category_name: "Handyman",
        services: [
            { name: "Furniture Assembly", price: 70, pricing_type: "fixed" },
            { name: "TV Mounting", price: 120, pricing_type: "fixed" },
            { name: "General Handyman (Hourly)", price: 65, pricing_type: "hourly" },
        ],
        rating_avg: 4.6,
        rating_count: 58,
    },
    {
        full_name: "David Kim",
        email: "david.hvac@fixora-demo.com",
        phone: "+1-732-555-0105",
        address_line1: "390 Ridgewood Ave",
        city: "Glen Ridge",
        state: "NJ",
        zip: "07028",
        bio: "HVAC specialist with 10+ years experience. Heating, AC, ductwork, and indoor air quality. Energy-efficient solutions for your home or business.",
        experience_years: 10,
        max_travel_miles: 30,
        category_name: "HVAC",
        services: [
            { name: "AC Repair", price: 150, pricing_type: "fixed" },
            { name: "Furnace Service", price: 180, pricing_type: "fixed" },
            { name: "AC Installation", price: 110, pricing_type: "hourly" },
        ],
        rating_avg: 4.9,
        rating_count: 64,
    },
    {
        full_name: "Tony Marino",
        email: "tony.painter@fixora-demo.com",
        phone: "+1-973-555-0106",
        address_line1: "210 Clifton Ave",
        city: "Clifton",
        state: "NJ",
        zip: "07011",
        bio: "Professional painter for interior and exterior projects. 20 years of experience. Free estimates, premium paints, clean job site guaranteed.",
        experience_years: 20,
        max_travel_miles: 40,
        category_name: "Painting",
        services: [
            { name: "Interior Room Painting", price: 350, pricing_type: "fixed" },
            { name: "Exterior House Painting", price: 75, pricing_type: "hourly" },
            { name: "Cabinet Refinishing", price: 800, pricing_type: "fixed" },
        ],
        rating_avg: 4.5,
        rating_count: 29,
    },
    {
        full_name: "Priya Sharma",
        email: "priya.landscaping@fixora-demo.com",
        phone: "+1-908-555-0107",
        address_line1: "85 Park Ave",
        city: "Plainfield",
        state: "NJ",
        zip: "07060",
        bio: "Landscape design and lawn care expert. Spring/fall cleanups, garden design, mulching, and tree trimming. Sustainable practices.",
        experience_years: 7,
        max_travel_miles: 25,
        category_name: "Landscaping",
        services: [
            { name: "Lawn Mowing", price: 60, pricing_type: "fixed" },
            { name: "Spring Cleanup", price: 250, pricing_type: "fixed" },
            { name: "Garden Design", price: 80, pricing_type: "hourly" },
        ],
        rating_avg: 4.8,
        rating_count: 41,
    },
    {
        full_name: "Mike Johnson",
        email: "mike.carpenter@fixora-demo.com",
        phone: "+1-609-555-0108",
        address_line1: "120 Princeton Pike",
        city: "Princeton",
        state: "NJ",
        zip: "08540",
        bio: "Custom carpentry and woodworking. Built-ins, kitchen cabinets, decks, and trim work. Quality craftsmanship at fair prices.",
        experience_years: 18,
        max_travel_miles: 35,
        category_name: "Carpentry",
        services: [
            { name: "Deck Building", price: 100, pricing_type: "hourly" },
            { name: "Custom Built-ins", price: 1500, pricing_type: "fixed" },
            { name: "Trim & Molding", price: 80, pricing_type: "hourly" },
        ],
        rating_avg: 4.7,
        rating_count: 52,
    },
];

const SAMPLE_REVIEWS = [
    "Excellent service! Very professional and on time.",
    "Did a fantastic job. Highly recommend!",
    "Reasonable price and quality work. Will hire again.",
    "Quick response, fair pricing, great results.",
    "Very knowledgeable and clean. Couldn't be happier.",
    "Showed up on time, finished early, professional throughout.",
    "Great communication and excellent workmanship.",
    "Very thorough and clean. Definitely recommend.",
];

async function getOrCreateCategory(name) {
    let cat = await Category.findOne({ category_name: name });
    if (!cat) {
        cat = await Category.create({
            category_name: name,
            icon: "🔧",
            is_active: true,
        });
        console.log(`  📁 Created category: ${name}`);
    }
    return cat;
}

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

    const passwordHash = await bcrypt.hash("DemoPass123!", 10);

    let createdProviders = 0;
    let updatedProviders = 0;

    for (const data of PROVIDERS) {
        let user = await User.findOne({ email: data.email });

        if (!user) {
            user = new User({
                full_name: data.full_name,
                email: data.email,
                phone: data.phone,
                password_hash: passwordHash,
                role: "provider",
                is_active: true,
                is_email_verified: true,
                is_profile_complete: true,
                provider_status: "verified",
                rating_avg: data.rating_avg,
                rating_count: data.rating_count,
            });
            console.log(`👤 Creating: ${data.full_name} (${data.city})`);
            createdProviders++;
        } else {
            console.log(`👤 Updating: ${data.full_name} (${data.city})`);
            user.is_active = true;
            user.is_email_verified = true;
            user.is_profile_complete = true;
            user.provider_status = "verified";
            user.rating_avg = data.rating_avg;
            user.rating_count = data.rating_count;
            updatedProviders++;
        }

        // Provider profile
        user.provider_profile = user.provider_profile || {};
        user.provider_profile.phone = data.phone;
        user.provider_profile.address_line1 = data.address_line1;
        user.provider_profile.city = data.city;
        user.provider_profile.state = data.state;
        user.provider_profile.zip = data.zip;
        user.provider_profile.bio = data.bio;
        user.provider_profile.experience_years = data.experience_years;
        user.provider_profile.max_travel_miles = data.max_travel_miles;
        user.provider_profile.is_available = true;

        // Geocode
        const fullAddress = `${data.address_line1}, ${data.city}, ${data.state} ${data.zip}`;
        const geo = await geocodeAddress(fullAddress);
        if (geo) {
            user.provider_profile.home_geo = {
                type: "Point",
                coordinates: [geo.lng, geo.lat],
            };
            user.provider_profile.formatted_address = geo.formatted_address;
            console.log(`  📍 Geocoded: [${geo.lng.toFixed(2)}, ${geo.lat.toFixed(2)}]`);
        } else {
            console.log(`  ⚠️  Geocode failed`);
        }

        await user.save();

        // Get/create category
        const category = await getOrCreateCategory(data.category_name);

        // Create services
        for (const svc of data.services) {
            const existing = await Service.findOne({
                provider_id: user._id,
                service_name: svc.name,
            });
            if (!existing) {
                await Service.create({
                    provider_id: user._id,
                    category_id: category._id,
                    service_name: svc.name,
                    description: `Professional ${svc.name.toLowerCase()} by ${data.full_name}.`,
                    price: svc.price,
                    pricing_type: svc.pricing_type,
                    is_active: true,
                    rating_avg: data.rating_avg,
                    rating_count: Math.floor(data.rating_count / data.services.length),
                });
                console.log(`  🔧 Service: ${svc.name} ($${svc.price} ${svc.pricing_type})`);
            }
        }

        // Rate limit Google Geocoding
        await new Promise((r) => setTimeout(r, 150));
    }

    console.log(`\n=== Done ===`);
    console.log(`✅ Created: ${createdProviders} providers`);
    console.log(`✅ Updated: ${updatedProviders} providers`);
    console.log(`\n💡 Login any provider with password: DemoPass123!`);

    await mongoose.disconnect();
    process.exit(0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});