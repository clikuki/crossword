// TODO: Use bigger but dirtier english dataset > https://github.com/harshnative/words-dataset

type Words = string[];
const words = (() => {
	let data: Words;
	return async () => {
		if (!data) {
			const response = await fetch("./words.json");
			data = await response.json();
		}

		return data;
	};
})();

words().then((wordList) => {
	console.log(wordList[Math.floor(Math.random() * wordList.length)]);
});
