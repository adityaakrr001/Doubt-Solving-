const STORAGE_KEY = "doubtSolving_result";

let selectedFiles = [];


/* =================================
   PAGE NAVIGATION
================================= */

function goToSolver() {
    window.location.href = "solver.html";
}


/* =================================
   DOM
================================= */

const questionInput =
    document.getElementById("question");

const charCount =
    document.getElementById("charCount");

const fileInput =
    document.getElementById("fileInput");

const filePreview =
    document.getElementById("filePreview");

const solveBtn =
    document.getElementById("solveBtn");

const voiceBtn =
    document.getElementById("voiceBtn");


/* =================================
   QUESTION COUNTER
================================= */

if (questionInput && charCount) {

    questionInput.addEventListener(
        "input",
        () => {

            charCount.textContent =
                questionInput.value.length;

        }
    );

}


/* =================================
   VOICE INPUT
================================= */

if (voiceBtn) {

    voiceBtn.addEventListener(
        "click",
        startVoiceInput
    );

}


function startVoiceInput() {

    const Recognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;


    if (!Recognition) {

        alert(
            "Voice input is not supported in this browser."
        );

        return;

    }


    const recognition =
        new Recognition();


    recognition.lang = "en-IN";

    recognition.interimResults = false;

    recognition.maxAlternatives = 1;


    voiceBtn.textContent =
        "🎙 Listening...";


    voiceBtn.disabled = true;


    recognition.start();


    recognition.onresult =
        event => {

            const text =
                event
                    .results[0][0]
                    .transcript;


            questionInput.value +=
                (
                    questionInput.value
                        ? "\n"
                        : ""
                ) + text;


            questionInput.dispatchEvent(
                new Event("input")
            );

        };


    recognition.onerror =
        () => {

            alert(
                "Unable to capture your voice."
            );

        };


    recognition.onend =
        () => {

            voiceBtn.textContent =
                "🎙 Speak";

            voiceBtn.disabled =
                false;

        };

}


/* =================================
   FILE INPUT
================================= */

if (fileInput) {

    fileInput.addEventListener(
        "change",
        () => {

            const newFiles =
                Array.from(
                    fileInput.files
                );


            selectedFiles.push(
                ...newFiles
            );


            renderFiles();


            fileInput.value = "";

        }
    );

}


/* =================================
   DRAG & DROP
================================= */

const uploadZone =
    document.getElementById("uploadZone");


if (uploadZone) {

    uploadZone.addEventListener(
        "dragover",
        event => {

            event.preventDefault();

            uploadZone.classList.add(
                "dragover"
            );

        }
    );


    uploadZone.addEventListener(
        "dragleave",
        () => {

            uploadZone.classList.remove(
                "dragover"
            );

        }
    );


    uploadZone.addEventListener(
        "drop",
        event => {

            event.preventDefault();

            uploadZone.classList.remove(
                "dragover"
            );


            const files =
                Array.from(
                    event.dataTransfer.files
                );


            selectedFiles.push(
                ...files
            );


            renderFiles();

        }
    );

}


/* =================================
   RENDER FILES
================================= */

function renderFiles() {

    if (!filePreview) return;


    filePreview.innerHTML = "";


    selectedFiles.forEach(
        (file, index) => {

            const item =
                document.createElement("div");


            item.className =
                "file-item";


            item.innerHTML = `

                <span>
                    📎
                    ${escapeHtml(file.name)}
                    ·
                    ${formatBytes(file.size)}
                </span>

                <span
                    class="remove-file"
                    data-index="${index}"
                >
                    Remove
                </span>

            `;


            filePreview.appendChild(item);

        }
    );


    document
        .querySelectorAll(".remove-file")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const index =
                        Number(
                            button.dataset.index
                        );


                    selectedFiles.splice(
                        index,
                        1
                    );


                    renderFiles();

                }
            );

        });

}


/* =================================
   FILE SIZE
================================= */

function formatBytes(bytes) {

    if (bytes < 1024)
        return `${bytes} B`;


    if (bytes < 1024 * 1024)
        return `${(
            bytes / 1024
        ).toFixed(1)} KB`;


    return `${(
        bytes / 1024 / 1024
    ).toFixed(1)} MB`;

}


/* =================================
   FILE → BASE64
================================= */

function fileToBase64(file) {

    return new Promise(
        (resolve, reject) => {

            const reader =
                new FileReader();


            reader.onload =
                () => resolve(
                    reader.result
                );


            reader.onerror =
                () => reject(
                    new Error(
                        "Could not read file."
                    )
                );


            reader.readAsDataURL(file);

        }
    );

}


/* =================================
   SOLVE DOUBT
================================= */

if (solveBtn) {

    solveBtn.addEventListener(
        "click",
        solveDoubt
    );

}


async function solveDoubt() {

    const question =
        questionInput
            ? questionInput.value.trim()
            : "";


    const subject =
        document.getElementById(
            "subject"
        )?.value || "General";


    const level =
        document.getElementById(
            "level"
        )?.value || "Beginner";


    if (
        !question &&
        selectedFiles.length === 0
    ) {

        alert(
            "Please type a question or upload a file."
        );

        return;

    }


    const MAX_SIZE =
        4 * 1024 * 1024;


    for (
        const file of selectedFiles
    ) {

        if (file.size > MAX_SIZE) {

            alert(
                `${file.name} is larger than 4 MB.`
            );

            return;

        }

    }


    solveBtn.disabled = true;


    solveBtn.innerHTML = `
        <span>ANALYSING...</span>
        <span class="arrow">✦</span>
    `;


    try {

        const files = [];


        for (
            const file of selectedFiles
        ) {

            const data =
                await fileToBase64(file);


            files.push({

                name: file.name,

                type:
                    file.type ||
                    "application/octet-stream",

                data

            });

        }


        const response =
            await fetch(
                "/.netlify/functions/solve",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({

                            question,

                            subject,

                            level,

                            files

                        })

                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.error ||
                "The AI could not solve this doubt."
            );

        }


        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({

                question,

                subject,

                level,

                answer:
                    data.answer,

                createdAt:
                    new Date().toISOString()

            })
        );


        window.location.href =
            "result.html";


    } catch (error) {

        console.error(error);


        alert(
            error.message ||
            "Something went wrong."
        );


        solveBtn.disabled =
            false;


        solveBtn.innerHTML = `
            <span>SOLVE MY DOUBT</span>
            <span class="arrow">→</span>
        `;

    }

}


/* =================================
   RESULT PAGE
================================= */

const answerOutput =
    document.getElementById(
        "answerOutput"
    );


if (answerOutput) {

    loadResult();

}


function loadResult() {

    const raw =
        localStorage.getItem(
            STORAGE_KEY
        );


    if (!raw) {

        window.location.href =
            "solver.html";

        return;

    }


    try {

        const data =
            JSON.parse(raw);


        document.getElementById(
            "questionOutput"
        ).textContent =
            data.question ||
            "Uploaded question";


        document.getElementById(
            "resultMeta"
        ).textContent =
            `${data.subject} · ${data.level}`;


        answerOutput.innerHTML =
            markdownToHtml(
                data.answer
            );


        document
            .getElementById(
                "loadingState"
            )
            .classList.add(
                "hidden"
            );


        document
            .getElementById(
                "resultContent"
            )
            .classList.remove(
                "hidden"
            );


    } catch (error) {

        console.error(error);


        window.location.href =
            "solver.html";

    }

}


/* =================================
   MARKDOWN
================================= */

function markdownToHtml(text) {

    if (!text) return "";


    let html =
        escapeHtml(text);


    html =
        html.replace(
            /^### (.*)$/gm,
            "<h3>$1</h3>"
        );


    html =
        html.replace(
            /^## (.*)$/gm,
            "<h2>$1</h2>"
        );


    html =
        html.replace(
            /^# (.*)$/gm,
            "<h1>$1</h1>"
        );


    html =
        html.replace(
            /\*\*(.*?)\*\*/g,
            "<strong>$1</strong>"
        );


    html =
        html.replace(
            /`([^`]+)`/g,
            "<code>$1</code>"
        );


    html =
        html.replace(
            /\n/g,
            "<br>"
        );


    return html;

}


/* =================================
   COPY
================================= */

const copyBtn =
    document.getElementById(
        "copyBtn"
    );


if (copyBtn) {

    copyBtn.addEventListener(
        "click",
        copyAnswer
    );

}


async function copyAnswer() {

    const raw =
        localStorage.getItem(
            STORAGE_KEY
        );


    if (!raw) return;


    const data =
        JSON.parse(raw);


    try {

        await navigator.clipboard
            .writeText(
                data.answer || ""
            );


        copyBtn.textContent =
            "✓ Copied";


        setTimeout(
            () => {

                copyBtn.textContent =
                    "⧉ Copy";

            },
            1600
        );


    } catch {

        alert(
            "Unable to copy the answer."
        );

    }

}


/* =================================
   SIMPLIFY
================================= */

const simplifyBtn =
    document.getElementById(
        "simplifyBtn"
    );


if (simplifyBtn) {

    simplifyBtn.addEventListener(
        "click",
        simplifyAnswer
    );

}


async function simplifyAnswer() {

    const raw =
        localStorage.getItem(
            STORAGE_KEY
        );


    if (!raw) return;


    const data =
        JSON.parse(raw);


    simplifyBtn.disabled =
        true;


    simplifyBtn.textContent =
        "Thinking...";


    try {

        const response =
            await fetch(
                "/.netlify/functions/solve",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({

                            question: `
Explain this answer in a simpler way for a
${data.level} student.

Original answer:
${data.answer}
`,

                            subject:
                                data.subject,

                            level:
                                data.level,

                            files: []

                        })

                }
            );


        const result =
            await response.json();


        if (!response.ok) {

            throw new Error(
                result.error
            );

        }


        data.answer =
            result.answer;


        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(data)
        );


        answerOutput.innerHTML =
            markdownToHtml(
                result.answer
            );


    } catch (error) {

        alert(
            error.message ||
            "Unable to simplify."
        );

    }


    simplifyBtn.disabled =
        false;


    simplifyBtn.textContent =
        "✦ Explain simpler";

}


/* =================================
   NEW DOUBT
================================= */

const newDoubtBtn =
    document.getElementById(
        "newDoubtBtn"
    );


if (newDoubtBtn) {

    newDoubtBtn.addEventListener(
        "click",
        () => {

            localStorage.removeItem(
                STORAGE_KEY
            );


            window.location.href =
                "solver.html";

        }
    );

}


/* =================================
   FOLLOW-UP
================================= */

const followupBtn =
    document.getElementById(
        "followupBtn"
    );


if (followupBtn) {

    followupBtn.addEventListener(
        "click",
        sendFollowup
    );

}


async function sendFollowup() {

    const input =
        document.getElementById(
            "followupInput"
        );


    const followup =
        input.value.trim();


    if (!followup) return;


    const raw =
        localStorage.getItem(
            STORAGE_KEY
        );


    if (!raw) return;


    const data =
        JSON.parse(raw);


    followupBtn.disabled =
        true;


    followupBtn.textContent =
        "…";


    try {

        const response =
            await fetch(
                "/.netlify/functions/solve",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({

                            question: `

Original question:
${data.question}

Previous answer:
${data.answer}

Student follow-up:
${followup}

Answer the follow-up directly
and explain it clearly.
`,

                            subject:
                                data.subject,

                            level:
                                data.level,

                            files: []

                        })

                }
            );


        const result =
            await response.json();


        if (!response.ok) {

            throw new Error(
                result.error
            );

        }


        data.answer +=
            `\n\n### Follow-up\n\n${result.answer}`;


        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(data)
        );


        answerOutput.innerHTML =
            markdownToHtml(
                data.answer
            );


        input.value = "";


    } catch (error) {

        alert(
            error.message ||
            "Unable to answer follow-up."
        );

    }


    followupBtn.disabled =
        false;


    followupBtn.textContent =
        "→";

}


/* =================================
   SECURITY
================================= */

function escapeHtml(value) {

    return String(value)

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );

}