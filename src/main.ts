// TODO: Use bigger but dirtier english dataset > https://github.com/harshnative/words-dataset
// TODO: Remove weird words in dataset

class Words {
	private static list: string[];
	private static listByLen = new Map<number, string[]>();
	private static async init(): Promise<void> {
		const response = await fetch("./words.json");
		this.list = await response.json();

		// Group words by length
		for (const word of this.list) {
			const group =
				this.listByLen.get(word.length) ??
				(() => {
					const newGroup: string[] = [];
					this.listByLen.set(word.length, newGroup);
					return [];
				})();
			group.push(word);
		}
	}

	public static async getRandom(cnt: number, wordLen = NaN): Promise<string[]> {
		if (!this.list) await this.init();

		const searchOn = isNaN(wordLen) ? this.list : this.listByLen.get(wordLen);
		if (!searchOn) throw "No word with requested length";

		return new Array(cnt)
			.fill(0)
			.map(() => searchOn[Math.floor(Math.random() * searchOn.length)]);
	}

	// Get words that contain only the letters from a given word
	public static async getWordWithChars(
		cnt: number,
		from: string
	): Promise<string[]> {
		if (!this.list) await this.init();

		let searchRange = 0;
		const searchArrays: string[][] = [];
		for (let i = 2; i <= from.length; i++) {
			if (this.listByLen.has(i)) {
				const group = this.listByLen.get(i)!;
				searchArrays.push(group);
				searchRange += group.length;
			}
		}

		const avoid = [undefined, from];
		return new Array(cnt).fill(0).map(() => {
			let word: string | undefined;
			let tryCount = 50000; // scale tryCount against cnt?
			while (avoid.includes(word) || !this.areCharacterSubsets(from, word!)) {
				if (tryCount-- <= 0) {
					throw new Error("Failed to find word with same letters");
				}

				let index = Math.floor(Math.random() * searchRange);
				let searchArrIndex = 0;
				while (true) {
					const curArrayLen = searchArrays[searchArrIndex].length;
					if (index >= curArrayLen) {
						index -= curArrayLen;
						searchArrIndex++;
					} else {
						break;
					}
				}

				word = searchArrays[searchArrIndex][index];
			}
			return word!;
		});
	}

	public static letterCount(word: string): Map<string, number> {
		return word.split("").reduce((map, letter) => {
			map.set(letter, (map.get(letter) ?? 0) + 1);
			return map;
		}, new Map<string, number>());
	}
	public static areCharacterSubsets(a: string, b: string): boolean {
		if (b.length > a.length) return false;
		const parentFreq = this.letterCount(a);
		const childFreq = this.letterCount(b);

		for (const [letter, cnt] of childFreq) {
			if (!parentFreq.has(letter) || parentFreq.get(letter)! < cnt) return false;
		}

		return true;
	}
}

const enum OVERLAP {
	NONE,
	MATCH, // Same letters
	SIDE, // Letters on side
	DIFF, // Non-matching letters
}
class WordGrid {
	public space: [string, number][][] = [];
	public words = new Map<string, [number, number][]>(); // Track positions of words
	public usedArea = [Infinity, Infinity, -Infinity, -Infinity]; // Left, Top, Right, Bottom
	private outdatedArea = false;

	public add(word: string, x: number, y: number, isHorz = true): boolean {
		if (this.words.has(word)) return false;

		// Store actual used grid space
		if (x < this.usedArea[0]) this.usedArea[0] = x;
		if (y < this.usedArea[1]) this.usedArea[1] = y;

		const posArr: [number, number][] = [];
		for (let i = 0; i < word.length; i++) {
			// Set letter at space or inc letter count
			if (!this.space[x]) this.space[x] = [];
			if (!this.space[x][y]) this.space[x][y] = [word[i], 1];
			else this.space[x][y][1]++;

			// Save letter position, then move along word
			posArr[i] = [x, y];
			if (isHorz) x++;
			else y++;
		}

		if (x > this.usedArea[2]) this.usedArea[2] = x;
		if (y > this.usedArea[3]) this.usedArea[3] = y;

		// Save word positions
		this.words.set(word, posArr);
		return true;
	}

	public del(word: string): boolean {
		if (this.words.has(word)) return false;
		const posArr = this.words.get(word)!;
		for (let i = 0; i < word.length; i++) {
			// If letter cnt < 1, delete letter
			const [x, y] = posArr[i];

			// Flag to update used grid size
			if (
				x <= this.usedArea[0] ||
				y <= this.usedArea[1] ||
				x >= this.usedArea[2] ||
				y >= this.usedArea[3]
			) {
				this.outdatedArea = true;
			}

			if (--this.space[x][y][1] < 1) {
				delete this.space[x][y];
			}
		}
		this.words.delete(word);

		return true;
	}

	public overlap(word: string, x: number, y: number, isHorz = true): OVERLAP {
		let letterOverlap = false;
		for (let i = 0; i < word.length; i++) {
			// Check if letter at x,y exists ...
			let letterMatch = false;
			if (this.space[x]?.[y]) {
				letterOverlap = true;
				// ... AND differs from current letter
				console.log(x, y, this.space[x][y][0]);
				if (this.space[x][y][0] !== word[i]) return OVERLAP.DIFF;
				else letterMatch = true;
			}

			// Check top and bottom
			const areaCheck: [number, number][] = [];
			if (isHorz || i === 0) areaCheck.push([x, y - 1]);
			if (isHorz || i === word.length - 1) areaCheck.push([x, y + 1]);
			if (!isHorz || i === 0) areaCheck.push([x - 1, y]);
			if (!isHorz || i === word.length - 1) areaCheck.push([x + 1, y]);
			for (const [ax, ay] of areaCheck) {
				if (this.space[ax]?.[ay]) return OVERLAP.SIDE;
			}

			// Move along word
			if (isHorz) x++;
			else y++;
		}
		return letterOverlap ? OVERLAP.MATCH : OVERLAP.NONE;
	}

	public stringify(): string {
		if (this.outdatedArea) {
			this.usedArea = [...this.words.values()].reduce(
				([lx, ly, hx, hy], list) => {
					return [
						Math.min(lx, list[0][0]),
						Math.min(ly, list[0][1]),
						Math.max(hx, list[list.length - 1][0]),
						Math.max(hy, list[list.length - 1][1]),
					];
				},
				[Infinity, Infinity, -Infinity, -Infinity]
			);
			this.outdatedArea = false;
		}

		let str = "";
		for (let y = this.usedArea[1]; y + 1 <= this.usedArea[3]; y++) {
			for (let x = this.usedArea[0]; x + 1 <= this.usedArea[2]; x++) {
				str += this.space[x]?.[y]?.[0] ?? " ";
			}
			if (y <= this.usedArea[3]) str += "\n";
		}
		return str;
	}
}

async function main() {
	const [parent] = await Words.getRandom(1, 6);
	const [child] = await Words.getWordWithChars(1, parent);
	const [grandchild] = await Words.getWordWithChars(1, child);
	console.log(parent, child, grandchild);

	const grid = new WordGrid();
	grid.add(parent, 0, 0);
	console.log(
		grid.overlap(
			child,
			parent.split("").findIndex((char) => char === child[0]),
			0,
			false
		)
	);
	grid.add(
		child,
		parent.split("").findIndex((char) => char === child[0]),
		0,
		false
	);

	const gridStr = grid.stringify();
	const table = document.createElement("table");
	let curRow;
	for (const char of gridStr) {
		if (!curRow || char === "\n") {
			curRow = document.createElement("tr");
			table.appendChild(curRow);
		}
		if (char !== "\n") {
			const charEl = document.createElement("td");
			if (char !== " ") charEl.textContent = char;
			curRow.appendChild(charEl);
		}
	}
	document.body.appendChild(table);
	console.log(gridStr);
}

main();
