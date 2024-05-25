interface Words {
	[key: string]: number;
}
const words = (() => {
	let data = "";
	return async () => {
		if (!data) {
			const response = await fetch("./words.json");
			data = await response.json();
		}

		return data;
	};
})();
