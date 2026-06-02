import bcrypt from "bcryptjs";
import { User } from "../models/Users.js";

export async function createUser({ full_name, email, phone, password, role }) {
    const password_hash = await bcrypt.hash(password, 10);

    const user = await User.create({
        full_name,
        email: String(email).toLowerCase(),
        phone,
        password_hash,
        role,
        is_active: true,
        is_email_verified: false,
    });

    return user;
}

export async function getUserByEmail(email) {
    return User.findOne({ email: String(email).toLowerCase() });
}

export async function comparePassword(password, password_hash) {
    return bcrypt.compare(String(password), String(password_hash || ""));
}

export async function setVerifyLink(userId, tokenHash, expiresAt) {
    return User.updateOne(
        { _id: userId },
        {
            $set: {
                email_verify_token_hash: tokenHash,
                email_verify_expires_at: expiresAt,
            },
        },
    );
}

export async function markEmailVerified(userId) {
    return User.updateOne(
        { _id: userId },
        {
            $set: { is_email_verified: true },
            $unset: { email_verify_token_hash: "", email_verify_expires_at: "" },
        },
    );
}