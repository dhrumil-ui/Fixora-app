import Anthropic from "@anthropic-ai/sdk";

const apiKey = process.env.ANTHROPIC_API_KEY;

if (!apiKey) {
    console.warn("⚠️  ANTHROPIC_API_KEY not set — AI features will fail");
}

const client = apiKey ? new Anthropic({ apiKey }) : null;

const MODEL_FAST = "claude-haiku-4-5";
const MODEL_SMART = "claude-sonnet-4-5";

export async function smartSearch({ query, services, customerLocation }) {
    if (!query || !services?.length) {
        return { picks: [], reasoning: null };
    }

    // Compact services for AI (don't send everything)
    const compact = services.slice(0, 20).map((s, idx) => ({
        idx,
        id: s._id,
        name: s.service_name,
        desc: (s.description || "").slice(0, 80),
        category: s.category_id?.category_name || "Other",
        provider: s.provider_id?.full_name || "Provider",
        price: s.price,
        pricing_type: s.pricing_type,
        rating: s.rating_avg || 0,
        rating_count: s.rating_count || 0,
        distance_mi: s._distance_miles ?? null,
        bio: (s.provider_id?.provider_profile?.bio || "").slice(0, 100),
    }));

    const prompt = `Customer is searching for a home service.

Customer query: "${query}"
Customer location: ${customerLocation || "unknown"}
Available services (with index numbers):
${JSON.stringify(compact, null, 2)}

Pick the TOP 3 services that best match the customer's query.
Consider: service category match, distance, rating, and provider expertise.

Respond ONLY with valid JSON in this exact format:
{
  "picks": [
    {
      "idx": <number from list above>,
      "reason": "<short 1-line reason why this is best, mention specific details>"
    }
  ]
}

If query doesn't match any service, return: { "picks": [] }`;

    try {
        const result = await aiGenerate({
            model: "claude-haiku-4-5",
            maxTokens: 600,
            system: "You are a home service matching expert. Output only valid JSON.",
            prompt,
        });
        const reply = typeof result === "string" ? result : result?.text || "";
        const cleaned = reply.replace(/```json\n?|```\n?/g, "").trim();
        const parsed = JSON.parse(cleaned);
        const picks = (parsed.picks || [])
            .filter((p) => typeof p.idx === "number" && p.idx < services.length)
            .map((p) => ({
                ...services[p.idx],
                _ai_reason: p.reason,
                _ai_picked: true,
            }));

        return { picks, reasoning: null };
    } catch (err) {
        console.error("[smartSearch] AI failed:", err.message);
        return { picks: [], error: err.message };
    }
}

export async function aiGenerate({
    system = "",
    prompt = "",
    model = MODEL_FAST,
    maxTokens = 1024,
}) {
    if (!client) {
        throw new Error("AI service not configured (missing ANTHROPIC_API_KEY)");
    }

    try {
        const response = await client.messages.create({
            model,
            max_tokens: maxTokens,
            system,
            messages: [{ role: "user", content: prompt }],
        });

        const text = response.content
            .filter((block) => block.type === "text")
            .map((block) => block.text)
            .join("\n")
            .trim();

        return {
            text,
            model,
            input_tokens: response.usage?.input_tokens || 0,
            output_tokens: response.usage?.output_tokens || 0,
        };
    } catch (err) {
        console.error("[ai] generation error:", err.message);
        throw new Error("AI generation failed: ", + err.message);
    }
}

/**
 * Generate a polished provider bio.
 */
export async function generateProviderBio({
    full_name,
    experience_years,
    services = [],
    rating_avg,
    rating_count,
    completed_jobs,
    city,
    bio_keywords = "",
    tone = "professional",
}) {
    const system = `You write professional, friendly bios for service providers on a home-service booking platform called Fixora. Keep bios 60-100 words, first person ("I am..."), warm but trustworthy. End with availability note. Never invent facts — only use what user provided. Output plain text, no markdown, no quotes.`;

    const prompt = `Write a bio for a service provider on Fixora.

Provider details:
- Name: ${full_name || "the provider"}
- Years of experience: ${experience_years || "unspecified"}
- Services offered: ${services.join(", ") || "general home services"}
- Rating: ${rating_avg ? `${rating_avg}★` : "new provider"} ${rating_count ? `(${rating_count} reviews)` : ""}
- Completed jobs: ${completed_jobs || 0}
- Service city: ${city || "local area"}
- Tone: ${tone}
${bio_keywords ? `- Keywords to include: ${bio_keywords}` : ""}

Write the bio now (plain text, 60-100 words):`;

    return aiGenerate({ system, prompt, model: MODEL_FAST, maxTokens: 400 });
}

/**
 * Customer support chatbot reply.
 */
export async function chatbotReply({ userMessage, conversationHistory = [], userContext = {} }) {
    const system = `You are Fixora's customer support assistant. Fixora is a home-service booking platform where customers book providers (plumbers, electricians, cleaners, handymen, etc.).

Help users with:
- How to book a service
- How payments work (Stripe, refunds within 24h of completion)
- Account / login issues  
- How to leave reviews
- How to contact provider
- Booking statuses (pending → confirmed → completed → reviewed)
- General platform questions

If you don't know an answer or it requires admin access, say so and suggest they email support@fixora.com.

Keep replies short (2-4 sentences), friendly, helpful. No markdown.`;

    const messages = [
        ...conversationHistory.map((m) => ({
            role: m.role,
            content: m.content,
        })),
        { role: "user", content: userMessage },
    ];

    if (!client) throw new Error("AI not configured");

    const response = await client.messages.create({
        model: MODEL_FAST,
        max_tokens: 500,
        system,
        messages,
    });

    const text = response.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();

    return { text, model: MODEL_FAST };
}

/**
 * Analyze customer complaint and suggest admin action.
 */
export async function analyzeIssue({
    issueDescription,
    bookingStatus,
    paymentStatus,
    amount,
    customerHistory = "no prior issues",
}) {
    const system = `You analyze customer complaints on Fixora (home-service platform) and suggest fair, professional admin actions. Output STRICTLY in this JSON shape:
{
  "severity": "low|medium|high|critical",
  "customer_mood": "calm|frustrated|angry|distressed",
  "recommended_action": "string describing what admin should do",
  "refund_amount_suggested": number or null,
  "draft_response": "string — draft email to customer",
  "reasoning": "1-2 sentence explanation"
}`;

    const prompt = `Analyze this customer complaint:

Description: ${issueDescription}
Booking status: ${bookingStatus}
Payment status: ${paymentStatus}
Amount paid: $${amount}
Customer history: ${customerHistory}

Output JSON only, no markdown fences:`;

    const result = await aiGenerate({
        system,
        prompt,
        model: MODEL_SMART,
        maxTokens: 600,
    });

    try {
        const cleaned = result.text.replace(/```json|```/g, "").trim();
        return { ...JSON.parse(cleaned), model: result.model };
    } catch (e) {
        console.error("[ai] failed to parse issue analysis JSON:", result.text);
        throw new Error("AI returned malformed JSON", { cause: e });
    }
}