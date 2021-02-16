exports.randomInt = (min, max) => {
	min = Math.ceil(min);
	max = Math.floor(max);
	return Math.floor(Math.random() * (max - min)) + min; //The maximum is exclusive and the minimum is inclusive
}

exports.capitalizeFirstLetter = str => {
	let string = str.split("");
	string[0] = string[0].toUpperCase();
	return string.join("");
}

exports.secondsToMSFormat = d => {
	d = Number(d);

	let m = Math.floor(d % 3600 / 60);
	let s = Math.floor(d % 3600 % 60);

	return ('0' + m).slice(-2) + ":" + ('0' + s).slice(-2);
}

exports.stringTruncate = (str, len) => {
	let length = len ? len : 10;
	let dots = str.length > length ? '...' : '';
	return str.substring(0, length) + dots;
};

exports.between = (num, min, max) => num >= min && num <= max; 

exports.angleBetween2Points = (p1, p2) => Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;

exports.linkToBase64 = link => {
	return new Promise((resolve, reject) => {
		fetch(link).then(a=>a.buffer()).then(buffer => {
			resolve(buffer.toString("base64"));
		});
	});
};