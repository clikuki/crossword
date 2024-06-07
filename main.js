import { generateCrossword, } from "./crossword.js";
// TODO: Use bigger but dirtier english dataset > https://github.com/harshnative/words-dataset
// TODO: Remove weird words in dataset
async function buildCrosswordHTML(crossword) {
    const gridStr = crossword.grid.stringify();
    const tableContents = document.createDocumentFragment();
    let curRow;
    for (const char of gridStr) {
        if (!curRow || char === "\n") {
            curRow = document.createElement("tr");
            tableContents.appendChild(curRow);
        }
        if (char !== "\n") {
            const charEl = document.createElement("td");
            charEl.textContent = char === " " ? "" : char;
            curRow.appendChild(charEl);
        }
    }
    const tableEl = document.querySelector("#crossword");
    tableEl.replaceChildren(tableContents);
}
generateCrossword({
    letters: [6, 20],
    wordAttempts: 25,
    avoidCorners: true,
}).then(buildCrosswordHTML);
const form = document.querySelector("form");
form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const crosswordSettings = {};
    for (const [key, value] of data) {
        switch (key) {
            case "exactLetters":
                crosswordSettings.exactLetters = !!+value;
                break;
            case "branchAttempts":
                crosswordSettings.branchAttempts = +value;
                break;
            case "wordAttempts":
                crosswordSettings.wordAttempts = +value;
                break;
            case "avoidCorners":
                crosswordSettings.avoidCorners = !!+value;
                break;
        }
    }
    console.log(crosswordSettings);
    generateCrossword(crosswordSettings).then(buildCrosswordHTML);
}, false);
