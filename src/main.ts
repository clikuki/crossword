import { generateCrossword, Crossword } from "./crossword.js";

// TODO: Use bigger but dirtier english dataset > https://github.com/harshnative/words-dataset
// TODO: Remove weird words in dataset

async function buildCrosswordHTML(crossword: Crossword) {
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

	const tableEl = document.querySelector("#crossword") as HTMLTableElement;
	tableEl.appendChild(tableContents);
}

generateCrossword({
	letters: [6, 20],
	wordAttempts: 25,
	avoidCorners: true,
}).then(buildCrosswordHTML);
