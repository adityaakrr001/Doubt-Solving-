exports.handler = async function (event) {

    const headers = {

        "Content-Type":
            "application/json",

        "Access-Control-Allow-Origin":
            "*",

        "Access-Control-Allow-Headers":
            "Content-Type",

        "Access-Control-Allow-Methods":
            "POST, OPTIONS"

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

                error:
                    "Method not allowed."

            })

        };

    }


    const apiKey =
        process.env.OPENAI_API_KEY;


    if (!apiKey) {

        return {

            statusCode: 500,

            headers,

            body: JSON.stringify({

                error:
                    "OPENAI_API_KEY is missing in Netlify."

            })

        };

    }


    let body;


    try {

        body =
            JSON.parse(
                event.body || "{}"
            );

    } catch {

        return {

            statusCode: 400,

            headers,

            body: JSON.stringify({

                error:
                    "Invalid request."

            })

        };

    }


    const question =
        String(
            body.question || ""
        ).trim();


    const subject =
        String(
            body.subject || "General"
        );


    const level =
        String(
            body.level || "Beginner"
        );


    const files =
        Array.isArray(body.files)
            ? body.files
            : [];


    if (
        !question &&
        files.length === 0
    ) {

        return {

            statusCode: 400,

            headers,

            body: JSON.stringify({

                error:
                    "Please provide a question or file."

            })

        };

    }


    const content = [];


    if (question) {

        content.push({

            type: "input_text",

            text: question

        });

    }


    /*
     * ADD FILES
     */

    for (
        const file of files
    ) {

        if (!file.data) {
            continue;
        }


        const type =
            String(
                file.type || ""
            );


        /*
         * IMAGE
         */

        if (
            type.startsWith("image/")
        ) {

            content.push({

                type: "input_image",

                image_url:
                    file.data

            });

            continue;

        }


        /*
         * PDF
         */

        if (
            type === "application/pdf" ||
            String(file.name || "")
                .toLowerCase()
                .endsWith(".pdf")
        ) {

            content.push({

                type: "input_file",

                filename:
                    file.name ||
                    "document.pdf",

                file_data:
                    file.data

            });

            continue;

        }


        /*
         * TEXT / MARKDOWN
         */

        if (
            type === "text/plain" ||
            String(file.name || "")
                .toLowerCase()
                .endsWith(".txt") ||
            String(file.name || "")
                .toLowerCase()
                .endsWith(".md")
        ) {

            try {

                const commaIndex =
                    file.data.indexOf(",");


                if (
                    commaIndex !== -1
                ) {

                    const base64 =
                        file.data.substring(
                            commaIndex + 1
                        );


                    const decoded =
                        Buffer.from(
                            base64,
                            "base64"
                        ).toString(
                            "utf8"
                        );


                    content.push({

                        type:
                            "input_text",

                        text:
                            `Uploaded file: ${file.name}

${decoded}`

                    });

                }

            } catch {

                /*
                 * Ignore unreadable text file.
                 */

            }

        }

    }


    /*
     * AI INSTRUCTIONS
     */

    const instructions = `

You are "Doubt Solving AI", an educational AI assistant.

Your purpose is to help students understand questions,
not merely give answers.

Student level:
${level}

Subject:
${subject}

IMPORTANT RULES:

1. Carefully understand the complete question.

2. Inspect uploaded images carefully.

3. Inspect uploaded PDF/document material when provided.

4. Solve mathematical calculations carefully.

5. Re-check calculations before giving the result.

6. Explain the reasoning step-by-step when appropriate.

7. Adapt the explanation to the student's level.

8. Give the direct answer clearly.

9. Explain why the answer is correct.

10. If useful, show an alternative method.

11. Never invent information.

12. Never pretend to know something that is unclear.

13. If the uploaded image is blurry or incomplete,
    clearly tell the student.

14. If important information is missing,
    ask for it instead of guessing.

15. Do not claim "100% accuracy".

16. For important academic facts or calculations,
    encourage verification when appropriate.

17. Keep simple questions concise.

18. Give detailed explanations for difficult questions.

Use this format when it makes sense:

## Answer

Give the direct answer.

## Step-by-step explanation

Explain the reasoning.

## Key concept

Explain the important concept or formula.

## Final answer

State the final result clearly.

For conceptual questions, you may use a more natural
structure instead.

`;


    /*
     * OPENAI REQUEST
     */

    const payload = {

        model:
            process.env.OPENAI_MODEL ||
            "gpt-5.6-luna",

        instructions,

        input: [

            {

                role: "user",

                content

            }

        ]

    };


    try {

        const response =
            await fetch(
                "https://api.openai.com/v1/responses",
                {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json",

                        "Authorization":
                            `Bearer ${apiKey}`

                    },

                    body:
                        JSON.stringify(
                            payload
                        )

                }
            );


        const raw =
            await response.text();


        let data;


        try {

            data =
                JSON.parse(raw);

        } catch {

            data = {};

        }


        if (!response.ok) {

            console.error(
                "OpenAI API error:",
                raw
            );


            return {

                statusCode:
                    response.status,

                headers,

                body:
                    JSON.stringify({

                        error:
                            data?.error?.message ||
                            "OpenAI request failed."

                    })

            };

        }


        let answer = "";


        /*
         * NORMAL RESPONSES API OUTPUT
         */

        if (
            typeof data.output_text ===
            "string"
        ) {

            answer =
                data.output_text;

        }


        /*
         * FALLBACK OUTPUT PARSER
         */

        if (
            !answer &&
            Array.isArray(data.output)
        ) {

            for (
                const outputItem
                of data.output
            ) {

                if (
                    !Array.isArray(
                        outputItem.content
                    )
                ) {

                    continue;

                }


                for (
                    const item
                    of outputItem.content
                ) {

                    if (
                        item.type ===
                        "output_text"
                    ) {

                        answer +=
                            item.text || "";

                    }

                }

            }

        }


        if (!answer.trim()) {

            answer =
                "Doubt Solving AI could not generate an answer. Please try again.";

        }


        return {

            statusCode: 200,

            headers,

            body:
                JSON.stringify({

                    answer

                })

        };


    } catch (error) {

        console.error(
            "Server error:",
            error
        );


        return {

            statusCode: 500,

            headers,

            body:
                JSON.stringify({

                    error:
                        "Unable to connect to Doubt Solving AI."

                })

        };

    }

};
