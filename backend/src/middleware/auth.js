import jwt from "jsonwebtoken";
import { User } from "../models/Users.js";

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const bearerToken = header.startsWith("Bearer ") ? header.slice(7) : null;

  const cookieToken = req.cookies?.fixora_token;
  const token = bearerToken || cookieToken;

  if (!token) return res.status(401).json({ message: "No token" });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
}

export async function requireProviderProfileComplete(req, res, next) {
  const provider = await User.findById(req.user.id).select("is_profile_complete provider_status");
  if (!provider) return res.status(401).json({ message: "Unauthorized" });

  if (!provider.is_profile_complete) {
    return res.status(400).json({
      message: "Provider profile not completed",
      code: "PROFILE_INCOMPLETE",
      provider_status: provider.provider_status || "draft",
    });
  }

  return next();
}