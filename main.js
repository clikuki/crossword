"use strict";
// TODO: Use bigger but dirtier english dataset > https://github.com/harshnative/words-dataset
// TODO: Remove weird words in dataset
class Words {
    static list;
    static listByLen = new Map();
    static async init() {
        const response = await fetch("./words.json");
        this.list = await response.json();
        // Group by len
        for (const word of this.list) {
            const group = this.listByLen.get(word.length) ??
                (() => {
                    const newGroup = [];
                    this.listByLen.set(word.length, newGroup);
                    return [];
                })();
            group.push(word);
        }
    }
    static async getRandom(cnt, wordLen = NaN) {
        if (!this.list)
            await this.init();
        const searchOn = isNaN(wordLen) ? this.list : this.listByLen.get(wordLen);
        if (!searchOn)
            throw "No word with requested length";
        return new Array(cnt)
            .fill(0)
            .map(() => searchOn[Math.floor(Math.random() * searchOn.length)]);
    }
    static async getWordWithChars(cnt, from) {
        if (!this.list)
            await this.init();
        let searchRange = 0;
        const searchArrays = [];
        for (let i = 2; i <= from.length; i++) {
            if (this.listByLen.has(i)) {
                const group = this.listByLen.get(i);
                searchArrays.push(group);
                searchRange += group.length;
            }
        }
        const avoid = [undefined, from];
        return new Array(cnt).fill(0).map(() => {
            let word;
            let tryCount = 50000; // scale tryCount against cnt?
            while (avoid.includes(word) || !this.areCharacterSubsets(from, word)) {
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
                    }
                    else {
                        break;
                    }
                }
                word = searchArrays[searchArrIndex][index];
            }
            return word;
        });
    }
    static letterCount(word) {
        return word.split("").reduce((map, letter) => {
            map.set(letter, (map.get(letter) ?? 0) + 1);
            return map;
        }, new Map());
    }
    static areCharacterSubsets(parent, child) {
        if (child.length > parent.length)
            return false;
        const parentFreq = this.letterCount(parent);
        const childFreq = this.letterCount(child);
        for (const [letter, cnt] of childFreq) {
            if (!parentFreq.has(letter) || parentFreq.get(letter) < cnt)
                return false;
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
