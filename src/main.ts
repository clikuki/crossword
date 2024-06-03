// TODO: Use bigger but dirtier english dataset > https://github.com/harshnative/words-dataset
// TODO: Remove weird words in dataset

interface WordData {
	length?: number | [min: number, max: number];
	characters?: {
		useExact: boolean;
		from: string;
	};
	ignore?: string[] | Set<string>;
}
class WordError extends Error {
	public static get NO_MATCH() {
		return new this("No words matching specification");
	}
	public static get CHAR_MATCH() {
		return new this("Failed to find word with same letters");
	}
	public static get RAND_TIME() {
		return new this("Failed to find word within reasonable time");
	}
	public static get IMPROPER_LENGTH() {
		return new this("Invalid word length");
	}
	public static get INVALID_CHARS() {
		return new this("Invalid character list");
	}
}
class Words {
	private static min_word_len = 3;
	private static max_word_len = -Infinity;
	private static list: [string, number][];
	private static listByLen = new Map<number, [string, number][]>();
	private static async init(): Promise<void> {
		const response = await fetch("./words.json");
		this.list = await response.json();

		// Group words by length
		for (const [word, freq] of this.list) {
			const group =
				this.listByLen.get(word.length) ??
				(() => {
					const newGroup: [string, number][] = [];
					this.listByLen.set(word.length, newGroup);
					if (word.length > this.max_word_len) this.max_word_len = word.length;
					return [];
				})();
			group.push([word, freq]);
		}
	}

	public static async *get({
		length,
		ignore,
		characters: chars,
	}: WordData): AsyncGenerator<string> {
		if (!this.list) await this.init();
		switch (typeof length) {
			case "number":
				if (length < this.min_word_len) throw WordError.IMPROPER_LENGTH;
				length = [length, length];
				break;
			case "object":
				if (Math.min(...length) < this.min_word_len)
					throw WordError.IMPROPER_LENGTH;
				if (length[0] > length[1]) length[1] = length[0];
				break;
		}
		if (chars && !/^[a-z]*$/i.test(chars.from)) throw WordError.INVALID_CHARS;
		if (ignore && Array.isArray(ignore)) ignore = new Set(ignore);

		let totalWeight = 0;
		const list =
			length === undefined
				? shuffleNew(this.list)
				: shuffleInPlace(
						[...this.listByLen.entries()]
							.filter(([len]) => len >= length[0] && len <= length[1])
							.flatMap(([, list]) =>
								list.filter(([word, freq]) => {
									const match =
										word != chars?.from &&
										(!chars || this.containsLetters(chars.from, word, chars.useExact));
									// && (!ignore || !ignore.has(word));
									if (match) totalWeight += freq;
									return match;
								})
							)
				  );
		if (!list.length) {
			console.log(list.length, length, ignore, chars);
			throw WordError.NO_MATCH;
		}
		if (totalWeight === 0) totalWeight = list.reduce((a, [, f]) => a + f, 0);

		while (list.length) {
			yield list.pop()![0];
		}
	}

	private static letterCount(word: string): Map<string, number> {
		return word.split("").reduce((map, letter) => {
			map.set(letter, (map.get(letter) ?? 0) + 1);
			return map;
		}, new Map<string, number>());
	}
	private static containsLetters(
		from: string,
		child: string,
		strict = false
	): boolean {
		// Child only uses the letters present in from, including the number a letter appears
		if (strict) {
			if (child.length > from.length) return false;
			const parentFreq = this.letterCount(from);
			const childFreq = this.letterCount(child);

			for (const [letter, cnt] of childFreq) {
				if (!parentFreq.has(letter) || parentFreq.get(letter)! < cnt) return false;
			}

			return true;
		}
		// child has at least one of the letters in from
		else return from.split("").some((char) => child.includes(char));
	}
}

const enum OVERLAP {
	NONE,
	MATCH, // Same letters
	SIDE, // Letters on side
	DIFF, // Non-matching letters
}
interface Cell {
	horz: string;
	vert: string;
	char: string;
}
class Grid {
	public space: Cell[][] = [];
	public wordList: string[] = [];
	public wordMap = new Map<string, [number, number][]>(); // Track positions of words
	public usedArea = [Infinity, Infinity, -Infinity, -Infinity]; // Left, Top, Right, Bottom
	private outdatedArea = false;

	public add(word: string, x: number, y: number, isHorz = true): boolean {
		if (this.wordMap.has(word)) return false;

		// Store actual used grid space
		if (x <= this.usedArea[0]) this.usedArea[0] = x;
		if (y <= this.usedArea[1]) this.usedArea[1] = y;

		const posArr: [number, number][] = [];
		for (let i = 0; i < word.length; i++) {
			// Set letter at space or inc letter count
			if (!this.space[x]) this.space[x] = [];
			if (!this.space[x][y])
				this.space[x][y] = {
					horz: isHorz ? word : "",
					vert: isHorz ? "" : word,
					char: word[i],
				};
			else {
				this.space[x][y][isHorz ? "horz" : "vert"] = word;
			}

			// Save letter position, then move along word
			posArr[i] = [x, y];
			if (isHorz) x++;
			else y++;
		}

		if (x >= this.usedArea[2]) this.usedArea[2] = x + 1;
		if (y >= this.usedArea[3]) this.usedArea[3] = y + 1;

		// Save word
		this.wordMap.set(word, posArr);
		this.wordList.push(word);
		return true;
	}

	public del(word: string): boolean {
		if (this.wordMap.has(word)) return false;
		const posArr = this.wordMap.get(word)!;
		const dirKey = this.isHorizontal(word) ? "horz" : "vert";
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

			this.space[x][y][dirKey] = "";
			if (!this.space[x][y].horz && !this.space[x][y].vert) {
				delete this.space[x][y];
			}
		}

		// Delete word from lists
		const wordIndex = this.wordList.findIndex((w) => w === word);
		const lastIndex = this.wordList.length - 1;
		[this.wordList[wordIndex], this.wordList[lastIndex]] = [
			this.wordList[lastIndex],
			this.wordList[wordIndex],
		];
		this.wordList.length--;
		this.wordMap.delete(word);
		return true;
	}

	public overlap(
		word: string,
		x: number,
		y: number,
		isHorz = true,
		noCornerTouching = true
	): OVERLAP {
		let overlap: undefined | [number, number];
		for (let i = 0; i < word.length; i++) {
			// Check if letter at x,y exists ...
			if (this.space[x]?.[y]) {
				// ... AND runs along same direction OR differs from current letter
				if (
					this.space[x][y][isHorz ? "horz" : "vert"] ||
					this.space[x][y].char !== word[i]
				) {
					return OVERLAP.DIFF;
				} else {
					overlap = [x, y];
				}
			}

			// Check if cell touches existing letters
			const surroundCheck: [number, number][] = [];
			const isMatched = JSON.stringify(overlap) === `[${x},${y}]`;
			const last = word.length - 1;
			if (noCornerTouching) {
				if (i === 0) surroundCheck.push([x - 1, y - 1]);
				if ((isHorz && i === last) || (!isHorz && i === 0))
					surroundCheck.push([x - 1, y + 1]);
				if ((isHorz && i === 0) || (!isHorz && i === last))
					surroundCheck.push([x + 1, y - 1]);
				if (i === last) surroundCheck.push([x + 1, y + 1]);
			}
			if ((isHorz && (isMatched || i === 0)) || (!isHorz && !isMatched))
				surroundCheck.push([x - 1, y]);
			if ((isHorz && (isMatched || i === last)) || (!isHorz && !isMatched))
				surroundCheck.push([x + 1, y]);
			if ((!isHorz && (isMatched || i === 0)) || (isHorz && !isMatched))
				surroundCheck.push([x, y - 1]);
			if ((!isHorz && (isMatched || i === last)) || (isHorz && !isMatched))
				surroundCheck.push([x, y + 1]);
			if (surroundCheck.some(([ax, ay]) => this.space[ax]?.[ay]))
				return OVERLAP.SIDE;

			// Move along word
			if (isHorz) x++;
			else y++;
		}
		return overlap ? OVERLAP.MATCH : OVERLAP.NONE;
	}

	public isHorizontal(word: string): boolean | null {
		const wordPos = this.wordMap.get(word);
		if (wordPos) return wordPos[0][0] !== wordPos[1][0];
		return null;
	}

	// Fix incorrect grid area
	public redefineArea() {
		this.usedArea = [...this.wordMap.values()].reduce(
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
		this.usedArea[2]++;
		this.usedArea[3]++;
		this.outdatedArea = false;
	}

	// TODO: fix extra space after stringify form
	public stringify(): string {
		if (this.outdatedArea) this.redefineArea();

		let str = "";
		for (let y = this.usedArea[1]; y < this.usedArea[3]; y++) {
			for (let x = this.usedArea[0]; x < this.usedArea[2]; x++) {
				const letter = this.space[x]?.[y]?.char ?? " ";
				str += letter;
			}
			if (y < this.usedArea[3]) str += "\n";
		}
		return str;
	}
}

function randBool(): boolean {
	return Math.random() < 0.5 ? false : true;
}
function randFloat(max = 1, min = 0): number {
	return Math.random() * (max - min) + min;
}
function randInt(max: number, min = 0): number {
	return Math.floor(randFloat(min, max));
}
function shuffleNew<T>(arr: T[]): T[] {
	const shuffled: T[] = [];
	const used = new Set<number>();
	while (shuffled.length < arr.length) {
		let index = randInt(arr.length);
		while (used.has(index)) index = (index + 1) % arr.length;
		used.add(index);
		shuffled.push(arr[index]);
	}
	return shuffled;
}
function shuffleInPlace<T>(arr: T[]): T[] {
	let i = arr.length;
	while (--i > 0) {
		const j = Math.floor(Math.random() * (i + 1));
		const tmp = arr[j];
		arr[j] = arr[i];
		arr[i] = tmp;
	}
	return arr;
}

async function main() {
	const grid = new Grid();
	// @ts-expect-error
	window.w = Words;

	const root = (await Words.get({ length: [6, 20] }).next()).value;
	console.log(root);
	grid.add(root, 0, 0, randBool());
	let children = Words.get({
		characters: { from: root, useExact: true },
	});

	const cycles = 50; // Number of branches to attempt
	const tryFor = 1000; // Retry limit for a branch
	for (let _ = 0; _ < cycles; _++) {
		try {
			const branch = grid.wordList[randInt(grid.wordList.length)];
			const branchPos = grid.wordMap.get(branch)!;
			const childIsHorz = !grid.isHorizontal(branch);

			placeWord: for (let _ = 1; _ < tryFor; _++) {
				// Refresh random word list if empty
				const result = await children.next();
				if (result.done) {
					children = Words.get({
						characters: { from: root, useExact: true },
						ignore: grid.wordList,
					});
					continue;
				}

				// Try each letter randomly to avoid going for earliest match
				const child = result.value;
				const randomIndices = shuffleInPlace(
					Array(child.length)
						.fill(0)
						.map((_, i) => i)
				);

				for (const childIndex of randomIndices) {
					const branchIndex = branch.indexOf(child[childIndex]);
					if (branchIndex === -1) continue;

					let [x, y] = branchPos[branchIndex];
					if (childIsHorz) x -= childIndex;
					else y -= childIndex;

					if (grid.overlap(child, x, y, childIsHorz) <= OVERLAP.MATCH) {
						grid.add(child, x, y, childIsHorz);
						break placeWord;
					}
				}
			}
		} catch (err) {
			if (err instanceof WordError) console.error(err);
			else throw err;
		}
	}

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
			charEl.textContent = char === " " ? "" : char;
			curRow.appendChild(charEl);
		}
	}
	document.body.appendChild(table);
}

main();
