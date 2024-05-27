"use strict";
// TODO: Use bigger but dirtier english dataset > https://github.com/harshnative/words-dataset
// TODO: Remove weird words in dataset
class Words {
    static list;
    static listByLen = new Map();
    static async init() {
        const response = await fetch("./words.json");
        this.list = await response.json();
        // Group words by length
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
    // Get words that contain only the letters from a given word
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
    static areCharacterSubsets(a, b) {
        if (b.length > a.length)
            return false;
        const parentFreq = this.letterCount(a);
        const childFreq = this.letterCount(b);
        for (const [letter, cnt] of childFreq) {
            if (!parentFreq.has(letter) || parentFreq.get(letter) < cnt)
                return false;
        }
        return true;
    }
}
class WordGrid {
    space = [];
    words = new Map(); // Track positions of words
    usedArea = [Infinity, Infinity, -Infinity, -Infinity]; // Left, Top, Right, Bottom
    outdatedArea = false;
    add(word, x, y, isHorz = true) {
        if (this.words.has(word))
            return false;
        // Store actual used grid space
        if (x < this.usedArea[0])
            this.usedArea[0] = x;
        if (y < this.usedArea[1])
            this.usedArea[1] = y;
        const posArr = [];
        for (let i = 0; i < word.length; i++) {
            // Set letter at space or inc letter count
            if (!this.space[x])
                this.space[x] = [];
            if (!this.space[x][y])
                this.space[x][y] = [word[i], 1];
            else
                this.space[x][y][1]++;
            // Save letter position, then move along word
            posArr[i] = [x, y];
            if (isHorz)
                x++;
            else
                y++;
        }
        if (x > this.usedArea[2])
            this.usedArea[2] = x;
        if (y > this.usedArea[3])
            this.usedArea[3] = y;
        // Save word positions
        this.words.set(word, posArr);
        return true;
    }
    del(word) {
        if (this.words.has(word))
            return false;
        const posArr = this.words.get(word);
        for (let i = 0; i < word.length; i++) {
            // If letter cnt < 1, delete letter
            const [x, y] = posArr[i];
            // Flag to update used grid size
            if (x <= this.usedArea[0] ||
                y <= this.usedArea[1] ||
                x >= this.usedArea[2] ||
                y >= this.usedArea[3]) {
                this.outdatedArea = true;
            }
            if (--this.space[x][y][1] < 1) {
                delete this.space[x][y];
            }
        }
        this.words.delete(word);
        return true;
    }
    overlap(word, x, y, isHorz = true) {
        for (let i = 0; i < word.length; i++) {
            // Check if letter at x,y exists AND differs from current letter
            if (this.space[x]?.[y] && this.space[x][y][0] === word[i])
                return true;
            // Move along word
            if (isHorz)
                x++;
            else
                y++;
        }
        return false;
    }
    stringify() {
        if (this.outdatedArea) {
            this.usedArea = [...this.words.values()].reduce(([lx, ly, hx, hy], list) => {
                return [
                    Math.min(lx, list[0][0]),
                    Math.min(ly, list[0][1]),
                    Math.max(hx, list[list.length - 1][0]),
                    Math.max(hy, list[list.length - 1][1]),
                ];
            }, [Infinity, Infinity, -Infinity, -Infinity]);
            this.outdatedArea = false;
        }
        let str = "";
        for (let y = this.usedArea[1]; y <= this.usedArea[3]; y++) {
            for (let x = this.usedArea[0]; x <= this.usedArea[2]; x++) {
                str += this.space[x]?.[y]?.[0] ?? " ";
            }
            if (y + 1 != this.usedArea[3])
                str += "\n";
        }
        return str;
    }
}
async function main() {
    const [parent] = await Words.getRandom(1, 6);
    const child = await Words.getWordWithChars(4, parent);
    console.log(parent, child);
    const grid = new WordGrid();
    grid.add(parent, 0, 0);
    grid.add(child[0], parent.split("").findIndex((char) => char === child[0][0]), 0, false);
    console.log(grid.stringify());
    // console.log(grid.space);
}
main();
