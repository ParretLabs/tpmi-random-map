const RandomMap = require('./random_map');

RandomMap.Generator({
	width: 0,
	height: 0,
	iterations: 300,
	padding: 5,
	seed: Math.floor(Math.random() * 10000),
	islandGapSize: undefined,
	boostPaddingMax: undefined,
	pupPaddingMax: undefined,
	teamBoostPaddingMax: undefined,
	pupPadding: undefined,
	spikePaddingMin: undefined,
	teamTiles: false,
	symmetry: "r"
}).then((data) => {
	console.log("generated map.");
});

function loadSettings(args, message, remix) {
	let settings = {};

	let attachment = message.attachments.first();

	// console.log(attachment);

	return new Promise((resolve, reject) => {
		if (attachment) {
			fetch(attachment.url).then(a => a.json()).then(json => {
				settings = json;
				
				// if(isNaN(Number(settings.width)) || isNaN(Number(settings.height)) || isNaN(Number(settings.iterations)) || isNaN(Number(settings.padding))) return resolve(null);
				settings.width = Math.min(Number(settings.width), 80) ? Math.min(Number(settings.width), 80) : null;
				settings.height = Math.min(Number(settings.height), 40) + 1 ? Math.min(Number(settings.height), 40) + 1 : null;

				settings.width = Math.max(10, settings.width);
				settings.height = Math.max(10, settings.height);

				settings.iterations = Math.min(Number(settings.iterations), 500);
				settings.padding = Math.min(Number(settings.padding), 20);
				// Check if text or number
				settings.seed = isNaN(Number(settings.seed)) ? textToNumber(settings.seed) : settings.seed;

				resolve(settings);
			}).catch(console.error);
		} else {
			if (!remix) {
				if (args[0] && typeof args[1] === "undefined") {
					settings.seed = args[0] || Math.floor(Math.random() * 1000000);
					settings.symmetry = "r";
					
					// Check if text or number
					settings.seed = isNaN(Number(settings.seed)) ? textToNumber(settings.seed) : settings.seed;

					return resolve(settings);
				}
				
				// if(isNaN(Number(args[0])) || isNaN(Number(args[1])) || isNaN(Number(args[2])) || isNaN(Number(args[3]))) return resolve(null);

				settings.width = args[0];
				settings.height = args[1];

				if (settings.width) {
					settings.width = Math.min(Number(settings.width), 80) ? Math.min(Number(settings.width), 80) : null;
					settings.height = Math.min(Number(settings.height), 40) + 1 ? Math.min(Number(settings.height), 40) + 1 : null;

					settings.width = Math.max(20, settings.width);
					settings.height = Math.max(20, settings.height);
				} else {
					settings.width = false;
					settings.height = false;
				}

				settings.iterations = Math.min(Number(args[2]), 600);
				settings.padding = Math.min(Number(args[3]), 20);

				settings.seed = args[5] || Math.floor(Math.random() * 1000000);
				
				// Check if text or number
				settings.seed = isNaN(Number(settings.seed)) ? textToNumber(settings.seed) : settings.seed;

				settings.symmetry = args[4] || "r";
			} else {
				// if(isNaN(Number(args[0])) || isNaN(Number(args[1])) || isNaN(Number(args[2]))) return resolve(null);
				console.log("remix", Number(args[1]));
				settings.remix = true;
				settings.symmetry = args[3] || "r";
				settings.seed = args[4] || Math.floor(Math.random() * 100000);
				
				// Check if text or number
				settings.seed = isNaN(Number(settings.seed)) ? textToNumber(settings.seed) : settings.seed;

				settings.iterations = Math.min(Number(args[1]), 600);
				settings.padding = Math.min(Number(args[2]), 20);
			}

			resolve(settings);
		}
	});
}