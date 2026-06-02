// src/utils/mailer.js — REPLACE entire file with this
import nodemailer from "nodemailer";
import sgMail from "@sendgrid/mail";
import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

const appName = process.env.APP_NAME || "Fixora";
const fromEmail = process.env.APP_FROM_EMAIL || process.env.GMAIL_USER;

let gmailTransport = null;
console.log("ENV CHECK:", {
    EMAIL_PROVIDER: process.env.EMAIL_PROVIDER,
    GMAIL_USER: !!process.env.GMAIL_USER,
    GMAIL_APP_PASSWORD: !!process.env.GMAIL_APP_PASSWORD,
});

function buildGmailTransport() {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return null;
    return nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD,
        },
    });
}

export function otpEmailTemplate({ otp, minutes }) {
    return {
        subject: `${appName} Email Verification OTP`,
        html: `
      <div style="font-family: Arial, sans-serif;">
        <h2>${appName} Verification</h2>
        <p>Your OTP is:</p>
        <h1 style="letter-spacing: 4px;">${otp}</h1>
        <p>This OTP expires in <b>${minutes}</b> minutes.</p>
      </div>
    `,
        text: `${appName} OTP: ${otp} (expires in ${minutes} min)`,
    };
}

// ============ NEW: PAYMENT RECEIPT ============
export function paymentReceiptTemplate({
    customerName,
    serviceName,
    providerName,
    amount,
    bookingDate,
    bookingTime,
    paymentId,
    bookingId,
}) {
    const amountStr = `$${Number(amount).toFixed(2)}`;
    return {
        subject: `${appName} — Payment Receipt #${paymentId}`,
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #2563EB; color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">Payment Received ✅</h1>
        </div>

        <div style="border: 1px solid #E5E7EB; border-top: none; padding: 24px; border-radius: 0 0 12px 12px;">
          <p style="font-size: 16px;">Hi <b>${customerName || "Customer"}</b>,</p>
          <p>Your payment has been processed successfully. Thank you for using ${appName}!</p>

          <h2 style="margin-top: 24px; font-size: 18px; color: #111827;">Receipt Details</h2>
          <table style="width: 100%; border-collapse: collapse; margin-top: 12px;">
            <tr><td style="padding: 8px 0; color: #6B7280;">Service:</td><td style="padding: 8px 0; text-align: right; font-weight: 600;">${serviceName || "—"}</td></tr>
            <tr><td style="padding: 8px 0; color: #6B7280;">Provider:</td><td style="padding: 8px 0; text-align: right; font-weight: 600;">${providerName || "—"}</td></tr>
            <tr><td style="padding: 8px 0; color: #6B7280;">Booking Date:</td><td style="padding: 8px 0; text-align: right;">${bookingDate || "—"} ${bookingTime || ""}</td></tr>
            <tr><td style="padding: 8px 0; color: #6B7280;">Booking ID:</td><td style="padding: 8px 0; text-align: right; font-family: monospace; font-size: 13px;">${bookingId}</td></tr>
            <tr><td style="padding: 8px 0; color: #6B7280;">Payment ID:</td><td style="padding: 8px 0; text-align: right; font-family: monospace; font-size: 13px;">${paymentId}</td></tr>
            <tr style="border-top: 2px solid #E5E7EB;"><td style="padding: 14px 0; font-weight: 700; font-size: 18px;">Total Paid:</td><td style="padding: 14px 0; text-align: right; font-weight: 800; font-size: 22px; color: #16A34A;">${amountStr}</td></tr>
          </table>

          <p style="margin-top: 24px; font-size: 14px; color: #6B7280;">
            This receipt is auto-generated. Keep it for your records.
          </p>
        </div>

        <div style="text-align: center; margin-top: 16px; font-size: 12px; color: #9CA3AF;">
          © ${new Date().getFullYear()} ${appName}. All rights reserved.
        </div>
      </div>
    `,
        text: `Payment Receipt #${paymentId}
Hi ${customerName || "Customer"},
Payment received: ${amountStr}
Service: ${serviceName}
Provider: ${providerName}
Booking: ${bookingDate} ${bookingTime}
Booking ID: ${bookingId}

Thank you for using ${appName}!`,
    };
}

export async function sendPaymentReceipt(data) {
    const { to, ...templateData } = data;
    if (!to) {
        console.warn("sendPaymentReceipt: no recipient email");
        return false;
    }
    const tpl = paymentReceiptTemplate(templateData);
    try {
        await sendEmail({ to, subject: tpl.subject, html: tpl.html, text: tpl.text });
        console.log(`📧 Receipt sent to ${to}`);
        return true;
    } catch (err) {
        console.error("Receipt email failed:", err.message);
        return false;
    }
}
// ============ END NEW ============

export async function sendEmail({ to, subject, html, text }) {
    const mode = (process.env.EMAIL_PROVIDER || "gmail").toLowerCase();

    if (!gmailTransport) gmailTransport = buildGmailTransport();
    if (process.env.SENDGRID_API_KEY) sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    const payload = {
        to,
        from: fromEmail,
        subject,
        text: text || "",
        html: html || "",
    };

    if (mode === "gmail") {
        if (!gmailTransport) throw new Error("Gmail SMTP not configured");
        await gmailTransport.sendMail(payload);
        return { provider: "gmail" };
    }

    if (mode === "sendgrid") {
        if (!process.env.SENDGRID_API_KEY) throw new Error("SendGrid not configured");
        await sgMail.send({ ...payload, from: process.env.SENDGRID_FROM_EMAIL || fromEmail });
        return { provider: "sendgrid" };
    }

    if (mode === "both") {
        try {
            if (!gmailTransport) throw new Error("Gmail SMTP not configured");
            await gmailTransport.sendMail(payload);
            return { provider: "gmail" };
        } catch (e) {
            if (!process.env.SENDGRID_API_KEY) throw e;
            await sgMail.send({ ...payload, from: process.env.SENDGRID_FROM_EMAIL || fromEmail });
            return { provider: "sendgrid" };
        }
    }

    throw new Error("Invalid EMAIL_PROVIDER");
}
