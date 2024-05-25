// TODO: Use bigger but dirtier english dataset > https://github.com/harshnative/words-dataset
// TODO: Remove weird words in dataset

class Words {
	private static list: string[];
	private static listByLen = new Map<number, string[]>();
	private static async init() {
		const response = await fetch("./words.json");
		this.list = await response.json();

		// Group by len
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

	public static letterCount(word: string) {
		return word.split("").reduce((map, letter) => {
			map.set(letter, (map.get(letter) ?? 0) + 1);
			return map;
		}, new Map<string, number>());
	}
	public static areCharacterSubsets(parent: string, child: string) {
		if (child.length > parent.length) return false;
		const parentFreq = this.letterCount(parent);
		const childFreq = this.letterCount(child);

		for (const [letter, cnt] of childFreq) {
			if (!parentFreq.has(letter) || parentFreq.get(letter)! < cnt) return false;
		}

		return true;
	}
}

async function main() {
	const [parent] = await Words.getRandom(1, 6);
	const child = await Words.getWordWithChars(4, parent);
	console.log(parent, child);
}

main();
