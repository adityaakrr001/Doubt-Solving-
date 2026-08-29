exports.handler = async function (event) {
    const headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
    };

    if (event.httpMethod === "OPTIONS") {
        return {
            statusCode: 204,
            headers,
            body: ""
        };
    }

    if (event.httpMethod !== "POST") {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({
                error: "Method not allowed."
            })
        };
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: "GEMINI_API_KEY is missing in Netlify."
            })
        };
    }

    let body;

    try {
        body = JSON.parse(event.body || "{}");
    } catch {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
                error: "Invalid request."
            })
        };
    }

    const question = String(body.question || "").trim();
    const subject = String(body.subject || "General");
    const level = String(body.level || "Beginner");
    const files = Array.isArray(body.files) ? body.files : [];

    if (!question && files.length === 0) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
                error: "Please provide a question or file."
            })
        };
    }

    const parts = [];

    parts.push({
        text: `
You are "Doubt Solving AI", an educational AI assistant.

Student level: ${level}
Subject: ${subject}

Solve the student's doubt carefully.

RULES:
- Understand the complete question.
- Carefully inspect uploaded images/documents.
- Show calculations step-by-step when useful.
- Explain concepts according to the student's level.
- Do not invent information.
- If something is unclear or missing, say so.
- Re-check mathematical calculations.
- Give the final answer clearly.
- Do not claim 100% accuracy.

Use this structure when appropriate:

## Answer

## Step-by-step explanation

## Key concept

## Final answer

Student question:

${question || "(Question is contained in the uploaded material.)"}
`
    });

    /*
     * Add uploaded files.
     * Gemini supports inline multimodal data.
     */
    for (const file of files) {
        if (!file.data) continue;

        const commaIndex = file.data.indexOf(",");

        const base64Data =
            commaIndex >= 0
                ? file.data.substring(commaIndex + 1)
                : file.data;

        const mimeType =
            file.type || "application/octet-stream";

        parts.push({
            inline_data: {
                mime_type: mimeType,
                data: base64Data
            }
        });
    }

    const model =
        process.env.GEMINI_MODEL ||
        "gemini-3.7-flash";

    const url =
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

    try {
        const response = await fetch(url, {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                contents: [
                    {
                        role: "user",
                        parts
                    }
                ]
            })
        });

        const raw = await response.text();

        let data;

        try {
            data = JSON.parse(raw);
        } catch {
            data = {};
        }

        if (!response.ok) {
            console.error("Gemini API error:", raw);

            return {
                statusCode: response.status,
                headers,
                body: JSON.stringify({
                    error:
                        data?.error?.message ||
                        "Gemini request failed."
                })
            };
        }

        const answer =
            data?.candidates?.[0]?.content?.parts
                ?.filter(part => typeof part.text === "string")
                ?.map(part => part.text)
                ?.join("\n") ||
            "Doubt Solving AI could not generate an answer. Please try again.";

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                answer
            })
        };

    } catch (error) {
        console.error("Server error:", error);

        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error:
                    "Unable to connect to Gemini AI."
            })
        };
    }
};
