export class Grid {
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
    overlap(word, x, y, isHorz = true, noCornerTouching = true) {
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
            // Check if cell touches existing letters
            const surroundCheck = [];
            const isMatched = JSON.stringify(overlap) === `[${x},${y}]`;
            const last = word.length - 1;
            if (noCornerTouching) {
                if (i === 0)
                    surroundCheck.push([x - 1, y - 1]);
                if ((isHorz && i === last) || (!isHorz && i === 0))
                    surroundCheck.push([x - 1, y + 1]);
                if ((isHorz && i === 0) || (!isHorz && i === last))
                    surroundCheck.push([x + 1, y - 1]);
                if (i === last)
                    surroundCheck.push([x + 1, y + 1]);
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
    // Fix incorrect grid area
    redefineArea() {
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
    // TODO: fix extra space after stringify form
    stringify() {
        if (this.outdatedArea)
            this.redefineArea();
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
