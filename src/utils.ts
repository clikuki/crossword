export function randBool(): boolean {
	return Math.random() < 0.5 ? false : true;
}
export function randFloat(max = 1, min = 0): number {
	return Math.random() * (max - min) + min;
}
export function randInt(max: number, min = 0): number {
	return Math.floor(randFloat(min, max));
}
export function shuffleNew<T>(arr: T[]): T[] {
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
export function shuffleInPlace<T>(arr: T[]): T[] {
	let i = arr.length;
	while (--i > 0) {
		const j = Math.floor(Math.random() * (i + 1));
		const tmp = arr[j];
		arr[j] = arr[i];
		arr[i] = tmp;
	}
	return arr;
}
