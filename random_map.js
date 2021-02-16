let cave = require('cave-automata-2d');
let ndFill = require('ndarray-fill');
let zeros = require('zeros');
let PNGImage = require('pngjs-image');
let fs = require('fs');

let Utils = require('./utils');

let fetch = require('node-fetch');

let { createCanvas, loadImage } = require('canvas');

let path = require('path');

let width = 0;
let height = 0;

let TILE_IDS = {
	FLOOR: 0,
	WALL: 1,
	REDFLAG: 2,
	BLUEFLAG: 3,
	BOMB: 4,
	SPIKE: 5,
	POWERUP: 6,
	BOOST: 7,
	GATE: 8,
	BUTTON: 9,
	REDBOOST: 10,
	BLUEBOOST: 11,
	REDTEAMTILE: 12,
	BLUETEAMTILE: 13,
	YELLOWTEAMTILE: 14,
	BACKGROUND: 15
}

let TILE_COLORS = [
	{ red: 212, green: 212, blue: 212, alpha: 255 }, // Floor
	{ red: 120, green: 120, blue: 120, alpha: 255 }, // Wall
	{ red: 255, green: 0, blue: 0, alpha: 255 }, // Red Flag
	{ red: 0, green: 0, blue: 255, alpha: 255 }, // Blue Flag
	{ red: 255, green: 128, blue: 0, alpha: 255 }, // Bomb
	{ red: 55, green: 55, blue: 55, alpha: 255 }, // Spike
	{ red: 0, green: 255, blue: 0, alpha: 255 }, // Powerup
	{ red: 255, green: 255, blue: 0, alpha: 255 }, // Boost
	{ red: 0, green: 117, blue: 0, alpha: 255 }, // Gate
	{ red: 185, green: 122, blue: 87, alpha: 255 }, // Button
	{ red: 255, green: 115, blue: 115, alpha: 255 }, // Red Boost
	{ red: 115, green: 115, blue: 255, alpha: 255 }, // Blue Boost
	{ red: 220, green: 186, blue: 186, alpha: 255 }, // Red Team Tile
	{ red: 187, green: 184, blue: 221, alpha: 255 }, // Blue Team Tile
	{ red: 220, green: 220, blue: 186, alpha: 255 }, // Yellow Team Tile
	{ red: 0, green: 0, blue: 0, alpha: 255 }, // Background
];

const IMAGES = [];

Object.keys(TILE_IDS).forEach(key => {
	IMAGES[TILE_IDS[key]] = loadImage(`./assets/${key.toLowerCase()}.png`).then(image => {
		IMAGES[TILE_IDS[key]] = image;
	});
});

Math.seed = function(s) {
	let mask = 0xffffffff;
	let m_w  = (123456789 + s) & mask;
	let m_z  = (987654321 - s) & mask;

	return function() {
		m_z = (36969 * (m_z & 65535) + (m_z >>> 16)) & mask;
		m_w = (18000 * (m_w & 65535) + (m_w >>> 16)) & mask;

		let result = ((m_z << 16) + (m_w & 65535)) >>> 0;
		result /= 4294967296;
		return result;
	}
}

let randomFunction = Math.seed(Date.now());

exports.Generator = (settings) => {
	let SETTINGS = settings || {};
	
	SETTINGS.seed = SETTINGS.seed || Math.floor(Math.random() * 100);
	
	randomFunction = Math.seed(SETTINGS.seed);
	
	// console.log("before", JSON.stringify(SETTINGS));
	
	SETTINGS.width = SETTINGS.width ? closestEvenNum(SETTINGS.width) : closestEvenNum(randomInt(43, 51));
	SETTINGS.height = SETTINGS.height || Math.floor((SETTINGS.width / 2) + closestEvenNum(randomInt(-2, 5)));
	
	// console.log("after", JSON.stringify(SETTINGS));
	
	// Defaults in comments
	SETTINGS.iterations = SETTINGS.iterations || randomInt(200, 400); // 300
	SETTINGS.padding = SETTINGS.padding || randomInt(3, 6); // 5
	
	SETTINGS.islandGapSize = SETTINGS.islandGapSize || randomInt(3, 5); // 3
	
	SETTINGS.boostPaddingMax = SETTINGS.boostPaddingMax || randomInt(3, 6); // 5
	SETTINGS.teamBoostPaddingMax = SETTINGS.teamBoostPaddingMax || randomInt(2, 4); // 3
	SETTINGS.pupPaddingMax = SETTINGS.pupPaddingMax || (SETTINGS.width / randomInt(20, 22)); // (SETTINGS.width / 20) + 3
	SETTINGS.pupPadding = SETTINGS.pupPadding || SETTINGS.width / randomInt(18, 20); // SETTINGS.width / 20
	SETTINGS.spikePaddingMin = SETTINGS.spikePaddingMin || 2;
	
	SETTINGS.teamTiles = SETTINGS.teamTiles ? true : false;
	
	SETTINGS.symmetry = SETTINGS.symmetry ? SETTINGS.symmetry : "r";
	
	function makeFakeFlagPoint(){
		return new Point(
			Math.floor(randomInt(SETTINGS.width / 8, SETTINGS.width / 2)),
			Math.floor(randomInt(SETTINGS.height / 8, SETTINGS.height / 2))
		);
	}
	
	function createMap(){
		
		let buffer;
		let routePoints;
		
		if(settings.remix){
			buffer = settings.map;
		} else {
			buffer = zeros([SETTINGS.width + 1, SETTINGS.height], "array");
		}

		width = buffer.shape[0] - 1;
		height = buffer.shape[1];
		
		let fillDensity = 0.41;
		
		if(!settings.remix){
			ndFill(buffer, function(x, y) {
				return randomFunction() <= fillDensity || (
					x <= 1 || x >= SETTINGS.width-2 ||
					y <= 1 || y >= SETTINGS.height-2
				) ? 1 : 0
			});
		}
		
		let iterate = cave(buffer, {
			threshold: 5,
			hood: 2,
			fill: false
		});

		iterate(SETTINGS.iterations);

		let map = buffer;

		let flagPoint = {x: randomInt(0, SETTINGS.width / 4), y: randomFunction() > 0.5 ? 0 : Math.floor(SETTINGS.height / 4)};
		let bombPoint = {x: 0, y: 0};
		
		// cleanUpThinWalls(map);
		// Log the cave
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				let tileType = map.get(x, y);
				process.stdout.write(tileType === TILE_IDS.WALL ? '■' : ' ');
			}
			process.stdout.write('\n');
		}
		
		fillRect(map, 0, 0, width, 1, TILE_IDS.WALL);
		fillRect(map, 0, 0, 1, height, TILE_IDS.WALL);
		fillRect(map, 0, height - 1, width, 1, TILE_IDS.WALL);
		fillRect(map, width - 1, 0, height, 1, TILE_IDS.WALL);

		for (let y = 0; y < height; y++) {
			for (let x = 0; x < Math.round(width / 2); x++) {
				let tileType = buffer.get(x, y);
				map.set((width - x), (height - y), tileType);
			}
		}
		
		// Log the cave
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				let tileType = map.get(x, y);
				process.stdout.write(tileType === TILE_IDS.WALL ? '■' : ' ');
			}
			process.stdout.write('\n');
		}

		// placeTeamTiles(map);

		flagPoint = placeFlag(map);
		
		// Remove useless wall blocks
//     removeUselessWallBlocks(map);

		bombPoint = flagPoint;

		placeBomb(map, bombPoint);

		placeBoosts(map);

		routePoints = createRoutes(map);

		placePowerup(map, routePoints);

		placeSpikes(map);
		
		let randomXOffset = randomInt(4);
		let randomYOffset = randomInt(2);
		
		let boostX = routePoints.bottomLeft.x - randomXOffset;
		let boostY = routePoints.bottomLeft.y - randomYOffset;

		map.set(boostX, boostY, TILE_IDS.BOOST);
		
		digPaths(map);

		placeGates(map, new Point(boostX, boostY));
		
		if(SETTINGS.teamTiles) placeTeamTiles(map, routePoints.floorPoints);
		
		cleanUp(map);
//     removeUselessWallBlocks(map);
		symmeterizeMap(map);
		
		// floodFill(map, Math.floor(SETTINGS.width / 2), Math.floor(SETTINGS.height / 2), TILE_IDS.)

		return new Promise((resolve, reject) => {
			let mapObj = {
				preview: null,
				source: null
			};
			createImageFromMap(map).then(sourceMap => {
				mapObj.source = sourceMap;
				createPreviewImageFromMap(map).then(previewMap => {
					mapObj.preview = previewMap;
					
					resolve(mapObj);
				});
			}).catch(console.error);
		});
	}

	function digPaths(map){
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				let tileType = map.get(x, y);

				if(tileType === TILE_IDS.BOOST || tileType === TILE_IDS.REDBOOST || tileType === TILE_IDS.POWERUP){
					let redFlagPoint = findTilePoints(map, TILE_IDS.REDFLAG)[0] || makeFakeFlagPoint();
					let blueFlagPoint = invertPoint(
						redFlagPoint
					);
					let tilePoint = new Point(x, y);

					let points = getLinePoints(blueFlagPoint, tilePoint);

					points.shift();
					points.pop();

					points.forEach((item, idx) => {
						thickBrush(map, item.x, item.y, TILE_IDS.FLOOR, 2);
					});
				}
			}
		}
	}

	function createRoutes(map){
		let redFlagPoint = findTilePoints(map, TILE_IDS.REDFLAG)[0] || makeFakeFlagPoint();
		let blueFlagPoint = invertPoint(redFlagPoint);

		let islandGapSize = SETTINGS.islandGapSize;

		let points = getLinePoints(redFlagPoint, blueFlagPoint);

		let middleRoutePoint = new Point(points[Math.floor(points.length / 2)].x, points[Math.floor(points.length / 2)].y);
		
		let pointDivider = randomFunction() < 0.5 ? 3 : (randomFunction() > 0.5 ? 4 : 5);

		let topRoutePoints = getLinePoints(middleRoutePoint, new Point(middleRoutePoint.x, 0));
		let topLeftRoutePoints = getLinePoints(middleRoutePoint, new Point(middleRoutePoint.x - (width / pointDivider), 0));
		let topRightRoutePoints = getLinePoints(middleRoutePoint, new Point(middleRoutePoint.x + (width / pointDivider), 0));
		let bottomRoutePoints = getLinePoints(middleRoutePoint, new Point(middleRoutePoint.x, height));
		let bottomLeftRoutePoints = getLinePoints(middleRoutePoint, new Point(middleRoutePoint.x - (width / pointDivider), height));
		let bottomRightRoutePoints = getLinePoints(middleRoutePoint, new Point(middleRoutePoint.x + (width / pointDivider), height));

		let topRoutePoint = topRoutePoints[Math.floor(topRoutePoints.length / 2)];
		let topRightRoutePoint = topRightRoutePoints[Math.floor(topRightRoutePoints.length / 2)];
		let topLeftRoutePoint = topLeftRoutePoints[Math.floor(topLeftRoutePoints.length / 2)];
		let bottomRoutePoint = bottomRoutePoints[Math.floor(bottomRoutePoints.length / 2)];
		let bottomRightRoutePoint = bottomRightRoutePoints[Math.floor(bottomRightRoutePoints.length / 2)];
		let bottomLeftRoutePoint = bottomLeftRoutePoints[Math.floor(bottomLeftRoutePoints.length / 2)];

		points = points.slice(Math.floor(points.length / 3), -Math.floor(points.length / 3));

		let floorPoints = points.splice((Math.round(points.length / 2) + 1) - islandGapSize, islandGapSize);

		points.forEach((item, idx) => {
			thickBrush(map, item.x, item.y, TILE_IDS.WALL, 2);
		});
		
		thickBrush(map, middleRoutePoint.x, middleRoutePoint.y, TILE_IDS.FLOOR, 3);
		
		console.log("floorPoints:", floorPoints);

		return {
			topLeft: topLeftRoutePoint,
			topRight: topRightRoutePoint,
			top: topRoutePoint,
			bottomLeft: bottomLeftRoutePoint,
			bottomRight: bottomRightRoutePoint,
			bottom: bottomRoutePoint,
			middle: middleRoutePoint,
			floorPoints
		};
	}

	function placeGates(map, point){
		let flagPoint = findTilePoints(map, TILE_IDS.REDFLAG)[0] || makeFakeFlagPoint();
		let boostPoint = point;

		let points = getLinePoints(boostPoint, flagPoint);

		let angle = Utils.angleBetween2Points(boostPoint, flagPoint);

		let gateAngle = "flat";

		console.log("Angle:", angle);

		//           if(Utils.between(angle, -180, -40)){
		//             gateAngle = "down";
		//           } else if(Utils.between(angle, 40, 180)){
		//             gateAngle = "up";
		//           }

		points.shift();
		points.pop();

		let gatePoint = points[points.length - Math.floor(SETTINGS.padding * 2) - 1];

		let buttonPoint = points[points.length - Math.floor(SETTINGS.padding * 1.5)];

		// if(!gatePoint) gatePoint = points[3];
		// if(!buttonPoint) gatePoint = points[2];

		console.log("past points");

		if(gatePoint && buttonPoint){
			let gateTilePoints = [];
			if(gateAngle === "up"){
				gateTilePoints = getLinePoints(new Point(gatePoint.x - 2, gatePoint.y - 2), new Point(gatePoint.x + 2, gatePoint.y + 2));
			} else if(gateAngle === "down"){
				gateTilePoints = getLinePoints(new Point(gatePoint.x + 2, gatePoint.y - 2), new Point(gatePoint.x - 2, gatePoint.y + 2));
			} else {
				gateTilePoints = getLinePoints(new Point(gatePoint.x, gatePoint.y - 2), new Point(gatePoint.x, gatePoint.y + 2));
			}
			
			thickBrush(map, gatePoint.x, gatePoint.y, TILE_IDS.FLOOR, 3);
			
			gateTilePoints.forEach((item, idx) => {
				thickBrush(map, item.x, item.y, TILE_IDS.GATE, 1);
			});

			map.set(buttonPoint.x, buttonPoint.y, TILE_IDS.BUTTON);

			console.log(gateTilePoints);
		}
	}

	function placeTeamTiles(map, floorPoints){
		floorPoints.forEach((item, idx) => {
			thickBrush(map, item.x, item.y, TILE_IDS.REDTEAMTILE, 2);
		});
	}

	function findTilePoints(map, tile){
		let points = [];
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				let tileType = map.get(x, y);

				if(tileType === tile){
					points.push(new Point(x, y));
				}
			}
		}

		return points;
	}

	function placeFlag(map){
		let topPoint = new Point(5, 5);
		let bottomPoint = new Point(0, height - 1);
		
		let chosenPoint = null;
		
		let chosenPointType = "bottom";
		
		for(let i = 0; map.get(topPoint.x, topPoint.y) === TILE_IDS.WALL; (topPoint.x += randomInt(3), topPoint.y += randomInt(3))){
			bottomPoint.x += randomInt(3);
			bottomPoint.y -= randomInt(3);
			if(map.get(bottomPoint.x, bottomPoint.y) !== TILE_IDS.WALL){
				chosenPoint = bottomPoint;
				break;
			}
		}
		
		if(!chosenPoint){
			chosenPoint = topPoint;
			chosenPointType = "top";
			console.log("Top Point");
		} else {
			console.log("Bottom Point");
		}
		
		console.log({chosenPoint});
		
		if(chosenPointType === "top"){
			chosenPoint.x += SETTINGS.padding;
			chosenPoint.y += SETTINGS.padding;
		} else {
			chosenPoint.x += SETTINGS.padding;
			chosenPoint.y -= SETTINGS.padding;
		}    

		fillRect(map, chosenPoint.x - 3, chosenPoint.y - 3, 7, 7, TILE_IDS.FLOOR);

		map.set(chosenPoint.x, chosenPoint.y, TILE_IDS.REDFLAG);

		return chosenPoint;
	}

	function placeBomb(map, point){
		let bombIndex = 0;

		while(true){
			if(map.get(point.x - bombIndex, point.y + bombIndex) === TILE_IDS.WALL){
				point.x -= bombIndex - 1;
				point.y += bombIndex - 1;
				break;
			} else if(map.get(point.x - bombIndex, point.y - bombIndex) === TILE_IDS.WALL){
				point.x -= bombIndex - 1;
				point.y -= bombIndex - 1;
				break;
			}

			bombIndex++;
			
			if(bombIndex > 10){
				break;
			}
		}
		
		console.log("bombed");

		map.set(point.x, point.y, TILE_IDS.BOMB);
	}

	function thickBrush(map, x, y, tile, thickness){
		fillRect(map, x - Math.floor(thickness / 2), y - Math.floor(thickness / 2), thickness, thickness, tile);
	}

	function placeBoosts(map){
		let redFlagPoint = findTilePoints(map, TILE_IDS.REDFLAG)[0] || makeFakeFlagPoint(); 
		
		let boostPaddingX = randomInt(SETTINGS.boostPaddingMax) + SETTINGS.padding + randomInt(2);
		let boostPaddingY = randomInt(SETTINGS.boostPaddingMax) + SETTINGS.padding + randomInt(2);
		
		if(!redFlagPoint) redFlagPoint = new Point(width / 4, height / 2);
		
		let boostPoint = {x: redFlagPoint.x + boostPaddingX, y: redFlagPoint.y + boostPaddingY};
		let teamBoostPoint = {x: redFlagPoint.x + boostPaddingX + randomInt(SETTINGS.teamBoostPaddingMax), y: redFlagPoint.y - boostPaddingY};
		for(let i = 0; map.get(boostPoint.x, boostPoint.y) === TILE_IDS.WALL || i < SETTINGS.teamBoostPaddingMax; i++){
			boostPoint.x++;
			boostPoint.y--;
		}

		for(let i = 0; map.get(boostPoint.x, boostPoint.y) === TILE_IDS.WALL || i < SETTINGS.boostPaddingMax; i++){
			teamBoostPoint.x++;
			teamBoostPoint.y++;
		}

		thickBrush(map, boostPoint.x, boostPoint.y, TILE_IDS.FLOOR, 3);
		thickBrush(map, Math.floor(teamBoostPoint.x), teamBoostPoint.y, TILE_IDS.FLOOR, 3);

		map.set(boostPoint.x, boostPoint.y, TILE_IDS.BOOST);
		map.set(Math.floor(teamBoostPoint.x), teamBoostPoint.y, TILE_IDS.REDBOOST);
		
		console.log("boosted", {teamBoostPoint, boostPoint});
	}

	function placePowerup(map, points){
		
		let pupPadder = SETTINGS.pupPadding;

		let pupPoint;
		
		if(SETTINGS.symmetry === "r"){
			pupPoint = new Point(points.top.x - Utils.randomInt(1, SETTINGS.pupPaddingMax), points.top.y - Utils.randomInt(1, SETTINGS.pupPaddingMax));
			
			thickBrush(map, pupPoint.x, pupPoint.y, TILE_IDS.FLOOR, pupPadder);
			map.set(pupPoint.x, pupPoint.y, TILE_IDS.POWERUP);
		} else {
			pupPoint = new Point(points.top.x, points.top.y - Utils.randomInt(1, SETTINGS.pupPaddingMax / 2));
			
			let pupPoint2 = new Point(points.bottom.x, points.bottom.y + Utils.randomInt(1, SETTINGS.pupPaddingMax / 2));
			
			thickBrush(map, pupPoint.x, pupPoint.y, TILE_IDS.FLOOR, pupPadder);
			map.set(pupPoint.x, pupPoint.y, TILE_IDS.POWERUP);
			
			thickBrush(map, pupPoint2.x, pupPoint2.y, TILE_IDS.FLOOR, pupPadder);
			map.set(pupPoint2.x, pupPoint2.y, TILE_IDS.POWERUP);
		}
	}

	function placeSpikes(map){
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				let tileType = map.get(x, y);

				if(tileType === TILE_IDS.BOMB){
					let spikePoint = {x: x + SETTINGS.spikePaddingMin, y: y};
					for(let i = 0; map.get(spikePoint.x, spikePoint.y) !== TILE_IDS.WALL; i++){
						spikePoint.x++;
					}

					map.set(spikePoint.x, spikePoint.y, TILE_IDS.SPIKE);
				} else if(tileType === TILE_IDS.POWERUP){
					let spikePoint = {x: x + SETTINGS.spikePaddingMin, y: y + SETTINGS.spikePaddingMin};
					for(let i = 0; map.get(spikePoint.x, spikePoint.y) !== TILE_IDS.WALL; i++){
						spikePoint.x++;
						spikePoint.y++;
					}

					map.set(spikePoint.x, spikePoint.y, TILE_IDS.SPIKE);
				} else if(tileType === TILE_IDS.BOOST){
					place4SpikeAroundPoint(map, {x: x, y: y}, 3, true);
				}
			}
		}
	}

	function place4SpikeAroundPoint(map, point, minSpikes, diag){
		let spikePadding = SETTINGS.spikePaddingMin;
		if(diag){
			let spikePoint1 = {x: point.x + spikePadding, y: point.y + spikePadding};
			let spikePoint2 = {x: point.x - spikePadding, y: point.y + spikePadding};
			let spikePoint3 = {x: point.x + spikePadding, y: point.y - spikePadding};
			let spikePoint4 = {x: point.x - spikePadding, y: point.y - spikePadding};
			
			let spikeMove1 = 0;
			let spikeMove2 = 0;
			let spikeMove3 = 0;
			let spikeMove4 = 0;

			for(; map.get(spikePoint1.x, spikePoint1.y) !== TILE_IDS.WALL; spikeMove1++){
				spikePoint1.x++;
				spikePoint1.y++;
			}

			for(; map.get(spikePoint2.x, spikePoint2.y) !== TILE_IDS.WALL; spikeMove2++){
				spikePoint2.x--;
				spikePoint2.y++;
			}

			for(; map.get(spikePoint3.x, spikePoint3.y) !== TILE_IDS.WALL; spikeMove3++){
				spikePoint3.x++;
				spikePoint3.y--;
			}

			for(; map.get(spikePoint4.x, spikePoint4.y) !== TILE_IDS.WALL; spikeMove4++){
				spikePoint4.x--;
				spikePoint4.y--;
			}

			if(spikeMove1 > minSpikes) map.set(spikePoint1.x - 1, spikePoint1.y - 1, TILE_IDS.SPIKE);
			if(spikeMove2 > minSpikes) map.set(spikePoint2.x + 1, spikePoint2.y - 1, TILE_IDS.SPIKE);
			if(spikeMove3 > minSpikes) map.set(spikePoint3.x - 1, spikePoint3.y + 1, TILE_IDS.SPIKE);
			if(spikeMove4 > minSpikes) map.set(spikePoint4.x + 1, spikePoint4.y + 1, TILE_IDS.SPIKE);
			
			console.log(spikeMove1, spikeMove2, spikeMove3, spikeMove4);
		}
	}

	function cleanUp(map){
		if(!findTilePoints(map, TILE_IDS.REDFLAG)[0]){
			let newFlagPoint = placeFlag(map);
			map.set(newFlagPoint.x, newFlagPoint.y, TILE_IDS.REDFLAG);
			map.set(invertPoint(newFlagPoint).x, invertPoint(newFlagPoint).y, TILE_IDS.BLUEFLAG);
		}
		
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < (width / 2); x++) {
				if(y === 0 || y === height - 1 || x === 0){
					map.set(x, y, TILE_IDS.BACKGROUND);
				}
				let tileType = map.get(x, y);

				if(tileType === TILE_IDS.FLOOR){
					if(map.get(x + 1, y) === TILE_IDS.WALL && map.get(x - 1, y) === TILE_IDS.WALL){
						map.set(x, y, TILE_IDS.WALL);
					} else if((map.get(x + 2, y) === TILE_IDS.WALL && map.get(x - 2, y) === TILE_IDS.WALL)){
						map.set(x, y, TILE_IDS.WALL);
						map.set(x + 1, y, TILE_IDS.WALL);
						map.set(x - 1, y, TILE_IDS.WALL);
						map.set(x + 2, y, TILE_IDS.WALL);
						map.set(x - 2, y, TILE_IDS.WALL);
					} else if((map.get(x, y + 2) === TILE_IDS.WALL && map.get(x, y - 2) === TILE_IDS.WALL)){
						map.set(x, y, TILE_IDS.WALL);
						map.set(x, y + 1, TILE_IDS.WALL);
						map.set(x, y - 1, TILE_IDS.WALL);
					}
					
					let wallScore = 0;
				
					if(map.get(x+1, y) === TILE_IDS.WALL) wallScore++;
					if(map.get(x-1, y) === TILE_IDS.WALL) wallScore++;
					if(map.get(x, y+1) === TILE_IDS.WALL) wallScore++;
					if(map.get(x, y-1) === TILE_IDS.WALL) wallScore++;
					if(map.get(x-1, y-1) === TILE_IDS.WALL) wallScore++;
					if(map.get(x+1, y-1) === TILE_IDS.WALL) wallScore++;
					if(map.get(x-1, y+1) === TILE_IDS.WALL) wallScore++;
					if(map.get(x+1, y+1) === TILE_IDS.WALL) wallScore++;
					
					if(wallScore > 6){
						map.set(x, y, TILE_IDS.WALL);
					}
				}
			}
		}
	}
	
	function removeUselessWallBlocks(map){
		for (let y = 0; y < height + 1; y++) {
			for (let x = 0; x < (width / 2) + 1; x++) {
				let tileType = map.get(x, y);
				if(tileType === TILE_IDS.WALL){
					if(!(
						hasNeighbor(map, x, y, TILE_IDS.FLOOR, true)
					)){
						map.set(x, y, TILE_IDS.BACKGROUND);
					}
				}
			}
		}
	}
	
	function cleanUpThinWalls(map){
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < (width / 2); x++) {

				let tileType = map.get(x, y);
				
				if(tileType === TILE_IDS.WALL){
					if(
						map.get(x, y + 1) === TILE_IDS.WALL &&
						map.get(x - 1, y) === TILE_IDS.FLOOR && map.get(x + 1, y) === TILE_IDS.FLOOR &&
						map.get(x - 1, y + 1) === TILE_IDS.FLOOR && map.get(x + 1, y + 1) === TILE_IDS.FLOOR 
					){
						map.set(x, y, TILE_IDS.FLOOR);
						map.set(x, y + 1, TILE_IDS.FLOOR);
					} else if(
						map.get(x + 1, y) === TILE_IDS.WALL &&
						map.get(x, y - 1) === TILE_IDS.FLOOR && map.get(x, y + 1) === TILE_IDS.FLOOR &&
						map.get(x + 1, y + 1) === TILE_IDS.FLOOR && map.get(x + 1, y - 1) === TILE_IDS.FLOOR 
					){
						map.set(x, y, TILE_IDS.FLOOR);
						map.set(x + 1, y, TILE_IDS.FLOOR);
					}
					
				}
			}
		}
	}

	function createImageFromMap(map){
		return new Promise(function(resolve, reject) {
			let image = PNGImage.createImage(width, height - 1);

			for (let y = 0; y < height + 1; y++) {
				for (let x = 0; x < width + 2; x++) {
					let tileType = map.get(x, y);
					let color = TILE_COLORS[tileType];

					// if(tileType !== 0 && tileType !== 1) console.log(color, tileType);

					let pixelX = x - 1;
					let pixelY = y - 1;

					image.setPixel(pixelX, pixelY, color);
				}
			}

			// console.log((width / 2) - 2, (height / 2) - 2, 5, 5, TILE_COLORS[TILE_IDS.FLOOR]);

			// image.fillRect(Math.floor(width / 2) - 2, Math.floor(height / 2) - 2, 5, 5, TILE_COLORS[TILE_IDS.FLOOR]);

			image.writeImage(__dirname + '/generated/map.png', function (err) {
				if (err) throw err;
				console.log('Written to the file');
				resolve();
			});
		});
	}

	function createPreviewImageFromMap(map){
		return new Promise(function(resolve, reject) {
			const canvas = createCanvas(width * 40, (height - 1) * 40);
			const ctx = canvas.getContext('2d');

			for (let y = 0; y < height + 1; y++) {
				for (let x = 0; x < width + 1; x++) {
					let tileType = map.get(x, y);
	
					if(IMAGES[tileType]) ctx.drawImage(IMAGES[tileType], (x - 1) * 40, (y - 1) * 40);
				}
			}

			const out = fs.createWriteStream(__dirname + '/generated/mappreview.png');
			const stream = canvas.createPNGStream();
			stream.pipe(out);

			out.on('finish', () => {
				console.log('The PNG file was created.');
				resolve(canvas.toDataURL());
			});
		});
	}

	function symmeterizeMap(map){
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < ((width) / 2); x++) {
				let tileType = map.get(x, y);

				let xPlace;
				let yPlace;
				
				if(SETTINGS.symmetry === "r"){
					xPlace = (width - x) + 1;
					yPlace = (height - y);
				} else {
					xPlace = (width - x) + 1;
					yPlace = y;
				}
				
				if(tileType === TILE_IDS.REDFLAG){
					map.set(xPlace, yPlace, TILE_IDS.BLUEFLAG);
				} else if(tileType === TILE_IDS.BLUEFLAG){
					map.set(xPlace, yPlace, TILE_IDS.REDFLAG);
				} else if(tileType === TILE_IDS.REDBOOST){
					map.set(xPlace, yPlace, TILE_IDS.BLUEBOOST);
				} else if(tileType === TILE_IDS.REDTEAMTILE){
					map.set(xPlace, yPlace, TILE_IDS.BLUETEAMTILE);
				} else if(tileType === TILE_IDS.BLUETEAMTILE){
					map.set(xPlace, yPlace, TILE_IDS.REDTEAMTILE);
				} else {
					map.set(xPlace, yPlace, tileType);
				}
			}
		}
		
		if(SETTINGS.symmetry === "r" && width % 2 !== 0){
			let middleTileX = Math.floor(width / 2) + 1;
			for (let y = 0; y < Math.floor(height / 2) + 1; y++) {
				let tileType = map.get(middleTileX, y);
				
				let xPlace = middleTileX;
				let yPlace = (height - y);
				
				if(tileType === TILE_IDS.REDTEAMTILE){
					map.set(middleTileX, y, TILE_IDS.YELLOWTEAMTILE);
					map.set(xPlace, yPlace, TILE_IDS.YELLOWTEAMTILE);
				} else {
					map.set(xPlace, yPlace, tileType);
				}
			}
		}
	}
	
	// this isnt inside the symmetry function
	
	return createMap();
}

exports.Shell = (settings) => {
	let randWidth = randomInt(42, 62);
	let randHeight = (randWidth / 2) + closestEvenNum(randomInt(0, 5));
	
	let SETTINGS = settings || {};
	
	SETTINGS.seed = SETTINGS.seed || Math.floor(Math.random() * 100);
	
	randomFunction = Math.seed(SETTINGS.seed);
	
	SETTINGS.width = closestEvenNum(SETTINGS.width) + 1 || closestEvenNum(randomInt(42, 62));
	SETTINGS.height = SETTINGS.height || (randWidth / 2) + closestEvenNum(randomInt(0, 5));
	
	// Defaults in comments
	SETTINGS.iterations = SETTINGS.iterations || randomInt(200, 500); // 300
	SETTINGS.padding = SETTINGS.padding || randomInt(6, 10); // 5
	
	let width = SETTINGS.width;
	let height = SETTINGS.height;
	
	
	function createMap(){
		
		let buffer;
		let routePoints;
		
		if(settings.remix){
			buffer = settings.map;
		} else {
			buffer = zeros([SETTINGS.width, SETTINGS.height], "array");
		}

		width = buffer.shape[0];
		height = buffer.shape[1];
		
		let iterate = cave(buffer, {
			density: 0.41,
			threshold: 5,
			hood: 2,
			fill: !settings.remix
		});

		iterate(SETTINGS.iterations);

		let map = buffer;
		
		fillRect(map, 0, 0, width, 1, TILE_IDS.WALL);
		fillRect(map, 0, 0, 1, height, TILE_IDS.WALL);
		fillRect(map, 0, height - 1, width, 1, TILE_IDS.WALL);
		
		removeUselessWallBlocks(map);
		
		// Symmetrize the cave
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < (width / 2); x++) {
				let tileType = buffer.get(x, y);
				map.set((width - x), (height - y - 1), tileType);
			}
		}
		
		// Log the cave
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				let tileType = map.get(x, y);
				process.stdout.write(tileType === TILE_IDS.WALL ? '■' : ' ');
			}
			process.stdout.write('\n');
		}
		
		symmeterizeMap(map);

		createImageFromMap(map).catch(console.error);

		return createPreviewImageFromMap(map);
	}
	
	function createImageFromMap(map){
		return new Promise(function(resolve, reject) {
			let image = PNGImage.createImage(width, height - 1);

			for (let y = 0; y < height + 1; y++) {
				for (let x = 0; x < width + 2; x++) {
					let tileType = map.get(x, y);
					let color = TILE_COLORS[tileType];

					// if(tileType !== 0 && tileType !== 1) console.log(color, tileType);

					let pixelX = x - 1;
					let pixelY = y - 1;

					image.setPixel(pixelX, pixelY, color);
				}
			}

			// console.log((width / 2) - 2, (height / 2) - 2, 5, 5, TILE_COLORS[TILE_IDS.FLOOR]);

			// image.fillRect(Math.floor(width / 2) - 2, Math.floor(height / 2) - 2, 5, 5, TILE_COLORS[TILE_IDS.FLOOR]);

			image.writeImage(__dirname + '/generated/map.png', function (err) {
				if (err) throw err;
				console.log('Written to the file');
				resolve();
			});
		});
	}

	function createPreviewImageFromMap(map){
		return new Promise(function(resolve, reject) {
			const canvas = createCanvas(width * 40, (height - 1) * 40);
			const ctx = canvas.getContext('2d');

			for (let y = 0; y < height + 1; y++) {
				for (let x = 0; x < width + 1; x++) {
					let tileType = map.get(x, y);
	
					if(IMAGES[tileType]) ctx.drawImage(IMAGES[tileType], (x - 1) * 40, (y - 1) * 40);
				}
			}

			const out = fs.createWriteStream(__dirname + '/generated/mappreview.png');
			const stream = canvas.createPNGStream();
			stream.pipe(out);

			out.on('finish', () => {
				console.log('The PNG file was created.');
				resolve();
			});
		});
	}
	
	function removeUselessWallBlocks(map){
		for (let y = 0; y < height + 1; y++) {
			for (let x = 0; x < (width / 2) + 1; x++) {
				let tileType = map.get(x, y);
				if(tileType === TILE_IDS.WALL){
					if(!(
						hasNeighbor(map, x, y, TILE_IDS.FLOOR, true)
					)){
						map.set(x, y, TILE_IDS.BACKGROUND);
					}
				}
			}
		}
	}
	
	function symmeterizeMap(map){
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < Math.round((width) / 2); x++) {
				let tileType = map.get(x, y);

				let xPlace;
				let yPlace;
				
				if(SETTINGS.symmetry === "r"){
					xPlace = (width - x) + 1;
					yPlace = (height - y);
				} else {
					xPlace = (width - x) + 1;
					yPlace = y;
				}
				
				if(tileType === TILE_IDS.REDFLAG){
					map.set(xPlace, yPlace, TILE_IDS.BLUEFLAG);
				} else if(tileType === TILE_IDS.BLUEFLAG){
					map.set(xPlace, yPlace, TILE_IDS.REDFLAG);
				} else if(tileType === TILE_IDS.REDBOOST){
					map.set(xPlace, yPlace, TILE_IDS.BLUEBOOST);
				} else if(tileType === TILE_IDS.BLUEBOOST){
					map.set(xPlace, yPlace, TILE_IDS.REDBOOST);
				} else if(tileType === TILE_IDS.REDTEAMTILE){
					map.set(xPlace, yPlace, TILE_IDS.BLUETEAMTILE);
				} else if(tileType === TILE_IDS.BLUETEAMTILE){
					map.set(xPlace, yPlace, TILE_IDS.REDTEAMTILE);
				} else {
					map.set(xPlace, yPlace, tileType);
				}
			}
		}
		
		if(SETTINGS.symmetry === "r" && width % 2 !== 0){
			let middleTileX = Math.floor(width / 2) + 1;
			for (let y = 0; y < Math.floor(height / 2) + 1; y++) {
				let tileType = map.get(middleTileX, y);
				
				let xPlace = middleTileX;
				let yPlace = (height - y);
				
				if(tileType === TILE_IDS.REDTEAMTILE){
					map.set(middleTileX, y, TILE_IDS.YELLOWTEAMTILE);
					map.set(xPlace, yPlace, TILE_IDS.YELLOWTEAMTILE);
				} else {
					map.set(xPlace, yPlace, tileType);
				}
			}
		}
	}
	
	return createMap();
}

function floodFill(map, x, y, targetColor, newColor){
	if(targetColor === newColor) return;
	if(map.get(x, y) !== targetColor) return;
	map.set(x, y, newColor);
	floodFill(map, x+1, y, targetColor, newColor);
	floodFill(map, x-1, y, targetColor, newColor);
	floodFill(map, x, y+1, targetColor, newColor);
	floodFill(map, x, y-1, targetColor, newColor);
	return;
}

function fillRect(map, x, y, width, height, tile){
	let newShape = map.hi(x + width, y + height).lo(x, y);
	
	let skipTiles = [TILE_IDS.BOMB, TILE_IDS.BOOST, TILE_IDS.REDBOOST, TILE_IDS.BLUEBOOST, TILE_IDS.POWERUP, TILE_IDS.REDFLAG, TILE_IDS.BLUEFLAG];
	
	for(let i=0; i < newShape.shape[0]; ++i) {
		for(let j=0; j < newShape.shape[1]; ++j) {
			let tileType = newShape.get(i, j);
			if(!skipTiles.includes(tileType)) newShape.set(i,j,tile);
		}
	}
}

function invertPoint(point){
	
	return new Point(width - point.x, height - point.y);
}

function hasNeighbor(map, x, y, targetTile, withDiagCheck){
	if(withDiagCheck){
		return(
			map.get(x+1, y) === targetTile || map.get(x-1, y) === targetTile || 
			map.get(x, y+1) === targetTile || map.get(x, y-1) === targetTile ||
			map.get(x-1, y-1) === targetTile || map.get(x+1, y-1) === targetTile || 
			map.get(x-1, y+1) === targetTile || map.get(x+1, y+1) === targetTile
		);
	} else {
		return (
			map.get(x+1, y) === targetTile || map.get(x-1, y) === targetTile || 
			map.get(x, y+1) === targetTile || map.get(x, y-1) === targetTile
		);
	}
}

function getLinePoints(p0, p1) {
	let points = [];
	let N = diagonal_distance(p0, p1);
	for (let step = 0; step <= N; step++) {
		let t = N == 0? 0.0 : step / N;
		points.push(round_point(lerp_point(p0, p1, t)));
	}
	return points;
}

function diagonal_distance(p0, p1) {
	let dx = p1.x - p0.x, dy = p1.y - p0.y;
	return Math.max(Math.abs(dx), Math.abs(dy));
}

function lerp_point(p0, p1, t) {
	return new Point(lerp(p0.x, p1.x, t), lerp(p0.y, p1.y, t));
}

function lerp(start, end, t) {
	return start + t * (end-start);
}

function round_point(p) {
	return new Point(Math.round(p.x), Math.round(p.y));
}

function Point(x, y){
	this.x = x;
	this.y = y;

	return this;
}

function isWallOrBackground(tile){
	return tile === TILE_IDS.WALL || tile === TILE_IDS.BACKGROUND;
}

function isFloorTile(tile){
	return tile === TILE_IDS.FLOOR;
}

function randomInt(min, max) {
	let newMin = Math.ceil(min);
	let newMax = Math.floor(max);
	if(typeof max === "undefined"){
		newMin = 0;
		newMax = min;
	}
	return Math.floor(randomFunction() * (newMax - newMin)) + newMin; //The maximum is exclusive and the minimum is inclusive
}

function randomDecimal(min, max) {
	return (randomFunction() * (min - max)) + min; //The maximum is exclusive and the minimum is inclusive
}

function randomBoolean() {
	return randomFunction() > 0.5 ? true : false;
}

function closestEvenNum(num, combo){
	return num % 2 ? num : num + (combo || (randomFunction() > 0.5 ? -1 : 1));
}