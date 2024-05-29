"use strict";
// TODO: Use bigger but dirtier english dataset > https://github.com/harshnative/words-dataset
// TODO: Remove weird words in dataset
const ERRORS = {
    WORD_LENGTH: "No word with requested length",
    CHAR_MATCH: "Failed to find word with same letters",
    RAND_TIME: "Failed to find word within reasonable time",
};
class Words {
    static list;
    static listByLen = new Map();
    static async init() {
        const response = await fetch("./words.json");
        this.list = await response.json();
        // Group words by length
        for (const [word, freq] of this.list) {
            const group = this.listByLen.get(word.length) ??
                (() => {
                    const newGroup = [];
                    this.listByLen.set(word.length, newGroup);
                    return [];
                })();
            group.push([word, freq]);
        }
    }
    static async getRandom(cnt, wordLen = NaN) {
        if (!this.list)
            await this.init();
        const used = new Set();
        if (isNaN(wordLen)) {
            const totalWeight = this.list.reduce((acc, [, cur]) => acc + cur, 0);
            return new Array(cnt).fill(0).map(() => {
                for (let _ = 0; _ < 1000; _++) {
                    let index = randInt(totalWeight);
                    for (let i = 0; i < this.list.length; i++) {
                        const [word, weight] = this.list[i];
                        if (index < weight && !used.has(word)) {
                            used.add(word);
                            return word;
                        }
                        else {
                            index -= weight;
                        }
                    }
                }
                throw new Error(ERRORS.RAND_TIME);
            });
        }
        else {
            const group = this.listByLen.get(wordLen);
            if (!group)
                throw new Error(ERRORS.WORD_LENGTH);
            const totalWeight = group.reduce((acc, [, cur]) => acc + cur, 0);
            return new Array(cnt).fill(0).map(() => {
                for (let _ = 0; _ < 1000; _++) {
                    let index = randInt(totalWeight);
                    for (let i = 0; i < group.length; i++) {
                        const [word, weight] = group[i];
                        if (index < weight && !used.has(word)) {
                            used.add(word);
                            return word;
                        }
                        else {
                            index -= weight;
                        }
                    }
                }
                throw new Error(ERRORS.RAND_TIME);
            });
        }
    }
    // Get words that contain only the letters from a given word
    static async getWordWithChars(cnt, from) {
        if (!this.list)
            await this.init();
        const searchOn = [];
        for (let i = 3; i <= from.length; i++) {
            if (this.listByLen.has(i)) {
                const group = this.listByLen.get(i);
                searchOn.push(...group);
            }
        }
        const totalWeight = searchOn.reduce((acc, [, cur]) => acc + cur, 0);
        const avoid = [undefined, from];
        return new Array(cnt).fill(0).map(() => {
            for (let _ = 0; _ < 1000; _++) {
                let index = randInt(totalWeight);
                for (let i = 0; i < searchOn.length; i++) {
                    const [word, weight] = searchOn[i];
                    if (index < weight && !avoid.includes(word)) {
                        avoid.push(word);
                        return word;
                    }
                    else {
                        index -= weight;
                    }
                }
            }
            throw new Error(ERRORS.RAND_TIME);
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
class Grid {
    space = [];
    wordList = [];
    wordMap = new Map(); // Track positions of words
    usedArea = [Infinity, Infinity, -Infinity, -Infinity]; // Left, Top, Right, Bottom
    outdatedArea = false;
    add(word, x, y, isHorz = true) {
        if (this.wordMap.has(word))
            return false;
        // Store actual used grid space
        if (x <= this.usedArea[0])
            this.usedArea[0] = x;
        if (y <= this.usedArea[1])
            this.usedArea[1] = y;
        const posArr = [];
        for (let i = 0; i < word.length; i++) {
            // Set letter at space or inc letter count
            if (!this.space[x])
                this.space[x] = [];
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
            if (isHorz)
                x++;
            else
                y++;
        }
        if (x >= this.usedArea[2])
            this.usedArea[2] = x + 1;
        if (y >= this.usedArea[3])
            this.usedArea[3] = y + 1;
        // Save word
        this.wordMap.set(word, posArr);
        this.wordList.push(word);
        return true;
    }
    del(word) {
        if (this.wordMap.has(word))
            return false;
        const posArr = this.wordMap.get(word);
        const dirKey = this.isHorizontal(word) ? "horz" : "vert";
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
    overlap(word, x, y, isHorz = true) {
        let overlap;
        for (let i = 0; i < word.length; i++) {
            // Check if letter at x,y exists ...
            if (this.space[x]?.[y]) {
                // ... AND runs along same direction OR differs from current letter
                if (this.space[x][y][isHorz ? "horz" : "vert"] ||
                    this.space[x][y].char !== word[i]) {
                    return 3 /* OVERLAP.DIFF */;
                }
                else {
                    overlap = [x, y];
                }
            }
            // Check top and bottom
            const surroundCheck = [];
            const isMatched = JSON.stringify(overlap) === `[${x},${y}]`;
            const last = word.length - 1;
            if ((isHorz && (isMatched || i === 0)) || (!isHorz && !isMatched))
                surroundCheck.push([x - 1, y]);
            if ((isHorz && (isMatched || i === last)) || (!isHorz && !isMatched))
                surroundCheck.push([x + 1, y]);
            if ((!isHorz && (isMatched || i === 0)) || (isHorz && !isMatched))
                surroundCheck.push([x, y - 1]);
            if ((!isHorz && (isMatched || i === last)) || (isHorz && !isMatched))
                surroundCheck.push([x, y + 1]);
            if (surroundCheck.some(([ax, ay]) => this.space[ax]?.[ay]))
                return 2 /* OVERLAP.SIDE */;
            // Move along word
            if (isHorz)
                x++;
            else
                y++;
        }
        return overlap ? 1 /* OVERLAP.MATCH */ : 0 /* OVERLAP.NONE */;
    }
    isHorizontal(word) {
        const wordPos = this.wordMap.get(word);
        if (wordPos)
            return wordPos[0][0] !== wordPos[1][0];
        return null;
    }
    // TODO: fix extra space after stringify form
    stringify() {
        if (this.outdatedArea) {
            this.usedArea = [...this.wordMap.values()].reduce(([lx, ly, hx, hy], list) => {
                return [
                    Math.min(lx, list[0][0]),
                    Math.min(ly, list[0][1]),
                    Math.max(hx, list[list.length - 1][0]),
                    Math.max(hy, list[list.length - 1][1]),
                ];
            }, [Infinity, Infinity, -Infinity, -Infinity]);
            this.usedArea[2]++;
            this.usedArea[3]++;
            this.outdatedArea = false;
        }
        let str = "";
        for (let y = this.usedArea[1]; y < this.usedArea[3]; y++) {
            for (let x = this.usedArea[0]; x < this.usedArea[2]; x++) {
                const letter = this.space[x]?.[y]?.char ?? " ";
                str += letter;
            }
            if (y < this.usedArea[3])
                str += "\n";
        }
        return str;
    }
}
function randBool() {
    return Math.random() < 0.5 ? false : true;
}
function randFloat(max, min = 0) {
    return Math.random() * (max - min) + min;
}
function randInt(max, min = 0) {
    return Math.floor(randFloat(min, max));
}
function shuffle(arr) {
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
    const [root] = await Words.getRandom(1, randInt(15, 6));
    grid.add(root, 0, 0, randBool());
    let fails = 0;
    const cycles = 10;
    for (let _ = 0; _ < cycles; _++) {
        try {
            const branch = grid.wordList[randInt(grid.wordList.length)];
            const branchPos = grid.wordMap.get(branch);
            const childIsHorz = !grid.isHorizontal(branch);
            const children = await Words.getWordWithChars(5, root);
            fails++;
            placeWord: for (const child of children) {
                if (grid.wordMap.has(child))
                    continue;
                const randomIndices = shuffle(Array(child.length)
                    .fill(0)
                    .map((_, i) => i));
                for (const childIndex of randomIndices) {
                    const branchIndex = branch.indexOf(child[childIndex]);
                    if (branchIndex === -1)
                        continue;
                    let [x, y] = branchPos[branchIndex];
                    if (childIsHorz)
                        x -= childIndex;
                    else
                        y -= childIndex;
                    if (grid.overlap(child, x, y, childIsHorz) <= 1 /* OVERLAP.MATCH */) {
                        fails--;
                        grid.add(child, x, y, childIsHorz);
                        break placeWord;
                    }
                }
            }
        }
        catch (err) {
            if (err !== ERRORS.CHAR_MATCH)
                throw err;
        }
    }
    console.log(fails / cycles);
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
            // if (char !== " ") charEl.textContent = char;
            charEl.textContent = char === " " ? "" : char;
            curRow.appendChild(charEl);
        }
    }
    document.body.appendChild(table);
}
main();
