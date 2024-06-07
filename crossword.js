import { Words, WordError } from "./words.js";
import { randInt, randBool, shuffleInPlace } from "./utils.js";
import { Grid } from "./grid.js";
export async function generateCrossword(params) {
    const grid = params.grid ?? new Grid();
    const childInit = {
        ignore: grid.wordList,
    };
    let totalWeight = 0;
    if (grid.wordList.length) {
        totalWeight = grid.wordList.reduce((a, _, i) => a + i + 1, 0);
    }
    else {
        let root;
        if (typeof params.letters === "string") {
            root = params.letters;
        }
        else {
            root = await Words.single({ length: params.letters ?? [6, 20] });
        }
        grid.add(root, 0, 0, randBool());
        childInit.characters = {
            from: root,
            useExact: !!params.exactLetters,
        };
    }
    let childGen = Words.multiple(childInit);
    const cycles = params.wordAttempts ?? 10; // Number of words to attempt
    const tryFor = params.branchAttempts ?? 1000; // Retry limit for a branch
    for (let _ = 0; _ < cycles; _++) {
        try {
            // Prioritize recently added words
            let weightedIndex = randInt(totalWeight);
            let branchIndex = 0;
            while (weightedIndex >= branchIndex + 1) {
                weightedIndex -= ++branchIndex;
            }
            const branch = grid.wordList[branchIndex];
            const branchPos = grid.wordMap.get(branch);
            const childIsHorz = !grid.isHorizontal(branch);
            placeWord: for (let _ = 1; _ < tryFor; _++) {
                // Refresh random word list if empty
                const result = await childGen.next();
                if (result.done) {
                    childGen = Words.multiple(childInit);
                    continue;
                }
                // Try each letter randomly to avoid going for earliest match
                const child = result.value;
                const randomIndices = shuffleInPlace(Array(child.length)
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
                    if (grid.overlap(child, x, y, childIsHorz, params.avoidCorners) <=
                        1 /* OVERLAP.MATCH */) {
                        grid.add(child, x, y, childIsHorz);
                        totalWeight += grid.wordList.length;
                        break placeWord;
                    }
                }
            }
        }
        catch (err) {
            if (err instanceof WordError)
                console.error(err);
            else
                throw err;
        }
    }
    return {
        grid,
        wordCount: grid.wordList.length,
        successRate: grid.wordList.length / cycles,
    };
}
