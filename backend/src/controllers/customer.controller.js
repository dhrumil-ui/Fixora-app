import mongoose from "mongoose";
import { User } from "../models/Users.js";
import { geocodeAddress } from "../utils/geocode.js";

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// GET /api/customer/saved-addresses
export async function listSavedAddresses(req, res) {
    try {
        const user = await User.findById(req.user.id).select("saved_addresses").lean();
        return res.json({ saved_addresses: user?.saved_addresses || [] });
    } catch (e) {
        return res.status(500).json({ message: e.message });
    }
}

// POST /api/customer/saved-addresses
export async function addSavedAddress(req, res) {
    try {
        const { label, address_text, is_primary } = req.body || {};
        if (!label || !address_text) {
            return res.status(400).json({ message: "Label and address are required" });
        }

        // Geocode the address
        const geo = await geocodeAddress(address_text);
        if (!geo) {
            return res.status(400).json({ message: "Could not find this address. Check spelling." });
        }

        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        // If is_primary, unmark others
        if (is_primary) {
            user.saved_addresses.forEach((a) => (a.is_primary = false));
        }

        user.saved_addresses.push({
            label: label.trim().slice(0, 50),
            address_text: address_text.trim(),
            formatted_address: geo.formatted_address,
            geo: { type: "Point", coordinates: [geo.lng, geo.lat] },
            is_primary: !!is_primary || user.saved_addresses.length === 0, // first one auto-primary
        });

        await user.save();
        return res.json({
            message: "Address saved",
            saved_addresses: user.saved_addresses,
        });
    } catch (e) {
        return res.status(500).json({ message: e.message });
    }
}

// DELETE /api/customer/saved-addresses/:addressId
export async function deleteSavedAddress(req, res) {
    try {
        const { addressId } = req.params;
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        user.saved_addresses = user.saved_addresses.filter(
            (a) => String(a._id) !== String(addressId)
        );
        await user.save();

        return res.json({ message: "Deleted", saved_addresses: user.saved_addresses });
    } catch (e) {
        return res.status(500).json({ message: e.message });
    }
}

// PATCH /api/customer/saved-addresses/:addressId/primary
export async function setPrimaryAddress(req, res) {
    try {
        const { addressId } = req.params;
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        let found = false;
        user.saved_addresses.forEach((a) => {
            if (String(a._id) === String(addressId)) {
                a.is_primary = true;
                found = true;
            } else {
                a.is_primary = false;
            }
        });

        if (!found) return res.status(404).json({ message: "Address not found" });
        await user.save();

        return res.json({ message: "Primary updated", saved_addresses: user.saved_addresses });
    } catch (e) {
        return res.status(500).json({ message: e.message });
    }
}

// GET /api/customer/favorites
export async function listFavorites(req, res) {
    try {
        const user = await User.findById(req.user.id)
            .populate({
                path: "favorite_providers",
                select: "full_name email rating_avg rating_count provider_profile",
            })
            .lean();
        return res.json({ favorites: user?.favorite_providers || [] });
    } catch (e) {
        return res.status(500).json({ message: e.message });
    }
}

// POST /api/customer/favorites/:providerId
export async function addFavorite(req, res) {
    try {
        const { providerId } = req.params;
        if (!isValidObjectId(providerId)) {
            return res.status(400).json({ message: "Invalid provider id" });
        }

        // Verify provider exists
        const provider = await User.findOne({ _id: providerId, role: "provider" });
        if (!provider) return res.status(404).json({ message: "Provider not found" });

        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        // Add if not already favorited
        const already = user.favorite_providers.some((id) => String(id) === String(providerId));
        if (!already) {
            user.favorite_providers.push(providerId);
            await user.save();
        }

        return res.json({ message: "Added to favorites", favorited: true });
    } catch (e) {
        return res.status(500).json({ message: e.message });
    }
}

// DELETE /api/customer/favorites/:providerId
export async function removeFavorite(req, res) {
    try {
        const { providerId } = req.params;
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        user.favorite_providers = user.favorite_providers.filter(
            (id) => String(id) !== String(providerId)
        );
        await user.save();

        return res.json({ message: "Removed from favorites", favorited: false });
    } catch (e) {
        return res.status(500).json({ message: e.message });
    }
}