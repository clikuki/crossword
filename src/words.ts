import { shuffleNew, shuffleInPlace, randInt } from "./utils.js";

export type LenRange = number | [min: number, max: number];
export type WordEntry = [string, number];
export interface WordData {
	length?: LenRange;
	characters?: {
		useExact: boolean;
		from: string;
	};
	ignore?: string[] | Set<string>;
}
export class Words {
	private static list: WordEntry[];
	private static listWeight = 0;
	private static listByLen = new Map<number, [WordEntry[], number]>();

	private static async init(): Promise<void> {
		const response = await fetch("./words.json");
		this.list = await response.json();

		// Group words by length
		for (const entry of this.list) {
			const [word, freq] = entry; // Keep ref to tuple

			this.listWeight += freq;
			if (this.listByLen.has(word.length)) {
				const sublistEntry = this.listByLen.get(word.length)!;
				sublistEntry[0].push(entry);
				sublistEntry[1] += freq;
			} else {
				const sublistEntry: [WordEntry[], number] = [[entry], freq];
				this.listByLen.set(word.length, sublistEntry);
			}
		}
	}

	// Quickly get many words
	public static async *multiple({
		length,
		ignore,
		characters: chars,
	}: WordData): AsyncGenerator<string> {
		if (!this.list) await this.init();
		if (chars && !/^[a-z]*$/i.test(chars.from)) throw WordError.INVALID_CHARS;
		if (ignore && Array.isArray(ignore)) ignore = new Set(ignore);

		// Filter wordlist
		let list: WordEntry[] = [];
		const listsToCheck: WordEntry[][] = [];
		if (length) {
			// Prune lists by length
			if (typeof length === "number") {
				if (this.listByLen.has(length)) {
					const [sublist] = this.listByLen.get(length)!;
					listsToCheck[0] = sublist;
				}
			} else {
				for (const [len, [sublist]] of this.listByLen) {
					if (len < length[0] || len > length[1]) continue;
					listsToCheck.push(sublist);
				}
			}
		} else if (chars || ignore) {
			// Select all words for filtering
			listsToCheck[0] = this.list;
		} else {
			// No filtering needed
			list = shuffleNew(this.list);
		}

		// Filter to-check lists
		if (listsToCheck.length) {
			for (const sublist of listsToCheck) {
				for (const entry of sublist) {
					const [word] = entry;
					if (
						word != chars?.from &&
						(!ignore || !ignore.has(word)) &&
						(!chars || this.containsLetters(chars.from, word, chars.useExact))
					) {
						list.push(entry);
					}
				}
			}
			shuffleInPlace(list);
		}

		if (!list.length) throw WordError.NO_MATCH;

		for (const [word] of list) {
			yield word;
		}
	}

	// Quickly get one word
	public static async single({
		length,
		ignore,
		characters: chars,
	}: WordData): Promise<string> {
		if (!this.list) await this.init();
		if (chars && !/^[a-z]*$/i.test(chars.from)) throw WordError.INVALID_CHARS;
		if (ignore && Array.isArray(ignore)) ignore = new Set(ignore);

		let listsToCheck: WordEntry[][] = [];
		let index = NaN;
		if (length) {
			let totalWeight = 0;
			if (typeof length === "number") {
				if (this.listByLen.has(length)) {
					const [sublist, subFreq] = this.listByLen.get(length)!;
					listsToCheck[0] = sublist;
					totalWeight = subFreq;
				}
			} else {
				for (const [len, [sublist, subfreq]] of this.listByLen) {
					if (len < length[0] || len > length[1]) continue;
					listsToCheck.push(sublist);
					totalWeight += subfreq;
				}
			}
			index = randInt(totalWeight);
		} else {
			listsToCheck[0] = this.list;
			index = randInt(this.listWeight);
		}

		for (const sublist of listsToCheck) {
			for (const [word, weight] of sublist) {
				if (
					index < weight &&
					(!ignore || !ignore.has(word)) &&
					(!chars || this.containsLetters(chars.from, word, chars.useExact))
				) {
					return word;
				} else {
					index -= weight;
				}
			}
		}
		throw WordError.NO_MATCH;
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
export class WordError extends Error {
	public static get NO_MATCH() {
		return new this("No words matching specification");
	}
	public static get INVALID_CHARS() {
		return new this("Invalid character list");
	}
}
