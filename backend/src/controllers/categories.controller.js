import { Category } from "../models/Categories.js";
import mongoose from "mongoose";
import { Service } from "../models/Services.js";
import { Booking } from "../models/Booking.js";

const PAGE_SIZE = 5;

export async function listCategories(req, res) {
  try {
    const { page, search = "", sort = "" } = req.query;
    const query = {};

    if (search) query.category_name = { $regex: search, $options: "i" };

    if (sort === "popular") {
      const popularCategories = await Category.aggregate([
        { $match: query },
        {
          $lookup: {
            from: "services",
            localField: "_id",
            foreignField: "category_id",
            as: "services",
          },
        },
        {
          $lookup: {
            from: "bookings",
            let: { serviceIds: "$services._id" },
            pipeline: [
              {
                $match: {
                  $expr: { $in: ["$service_id", "$$serviceIds"] },
                  status: { $in: ["confirmed", "completed", "work_completed"] },
                },
              },
            ],
            as: "bookings",
          },
        },
        {
          $addFields: {
            booking_count: { $size: "$bookings" },
            service_count: { $size: "$services" },
          },
        },
        {
          $project: {
            services: 0,
            bookings: 0,
          },
        },
        {
          $sort: {
            booking_count: -1,
            service_count: -1,
            category_name: 1,
          },
        },
      ]);

      return res.json({ categories: popularCategories });
    }

    if (!page) {
      const categories = await Category.find(query).sort({ createdAt: -1 });
      return res.json({ categories });
    }

    const skip = (Number(page) - 1) * PAGE_SIZE;
    const total = await Category.countDocuments(query);
    const categories = await Category.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(PAGE_SIZE);

    return res.json({
      categories,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / PAGE_SIZE),
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

// POST create category (admin only)
export async function createCategory(req, res) {
  try {
    const { category_name, icon, min_price, max_price, allowed_pricing_types } = req.body;

    if (!category_name?.trim()) {
      return res.status(400).json({ message: "Category name is required" });
    }

    if (min_price !== undefined && max_price !== undefined && Number(min_price) > Number(max_price)) {
      return res.status(400).json({ message: "Min price cannot be greater than max price" });
    }

    const existing = await Category.findOne({
      category_name: { $regex: new RegExp(`^${category_name.trim()}$`, "i") },
    });
    if (existing) return res.status(400).json({ message: "Category already exists" });

    const category = await Category.create({
      category_name: category_name.trim(),
      icon: icon?.trim() || "",
      min_price: min_price ?? 0,
      max_price: max_price ?? 9999,
      allowed_pricing_types: allowed_pricing_types || ["hourly", "fixed"],
    });

    return res.status(201).json({ message: "Category created", category });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

// PATCH update category (admin only)
export async function updateCategory(req, res) {
  try {
    const { category_name, icon, min_price, max_price, allowed_pricing_types } = req.body;

    if (min_price !== undefined && max_price !== undefined && Number(min_price) > Number(max_price)) {
      return res.status(400).json({ message: "Min price cannot be greater than max price" });
    }

    const updates = {};
    if (category_name) updates.category_name = category_name.trim();
    if (icon !== undefined) updates.icon = icon.trim();
    if (min_price !== undefined) updates.min_price = Number(min_price);
    if (max_price !== undefined) updates.max_price = Number(max_price);
    if (allowed_pricing_types) updates.allowed_pricing_types = allowed_pricing_types;

    const category = await Category.findByIdAndUpdate(
      req.params.id, updates, { new: true }
    );
    if (!category) return res.status(404).json({ message: "Category not found" });

    return res.json({ message: "Category updated", category });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

// DELETE category (admin only)
export async function deleteCategory(req, res) {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) return res.status(404).json({ message: "Category not found" });
    return res.json({ message: "Category deleted" });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

// PATCH toggle category active/inactive (admin only)
export async function toggleCategory(req, res) {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ message: "Category not found" });
    category.is_active = !category.is_active;
    await category.save();
    return res.json({
      message: `Category ${category.is_active ? "enabled" : "disabled"}`,
      category,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}