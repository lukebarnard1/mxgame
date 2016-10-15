const fs = require('fs');
const matrixSDK = require("matrix-js-sdk");

var mxClient = matrixSDK.createClient({baseUrl : "http://ldbco.de:8008"});
	
mxClient.startClient();

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

var CREDS_FILE = process.argv[2];
var roomId = process.argv[3];

if (!CREDS_FILE || !roomId) {
	console.error('Please provide arguments:\n\tnode client.js credfile.txt \'!room34356:matrix.org\'');
	process.exit(1);
}

var creds = null;
try {
	console.log('Reading credentials from ', CREDS_FILE);
	creds = JSON.parse(fs.readFileSync(CREDS_FILE));
} catch (e) {
	console.log(`Error reading credentials (${e.message})`);
}

if (creds) {
	console.log('Credentials loaded, starting...');
	start(creds.user_id, creds.access_token, roomId);
	return;
}

console.log('Please login to matrix:');

rl.question('Enter username: ', (user) => {
	rl.question('Enter password: ', (password) => {
		login(user, password, roomId);
	});
});

var gameRoomId = null;
var gameId = null;

function login(user, password, roomId) {

	mxClient.loginWithPassword(user, password).then(
		function (res) {
			// Always remember access token
			fs.writeFile(CREDS_FILE, JSON.stringify(
				{
					access_token : res.access_token,
					user_id : res.user_id
				}), 
				(err) => {if (err) throw err; }
			);

			readline.moveCursor(process.stdout, 0, -2);
			readline.clearScreenDown(process.stdout);
			
			start(res.user_id, res.access_token, roomId);
		},
		(e)=>{console.error(e)}
	);
}

function start(user, token, roomId) {
	console.log('\nLogged in!');
	gameId = user;

	mxClient = matrixSDK.createClient(
		{
			baseUrl : "http://ldbco.de:8008", 
			accessToken: token,
			userId: user
		});
	mxClient.on("Room.timeline", function(event, room, toStartOfTimeline) {
	    if (toStartOfTimeline) {
	        return; // ignore paginated results
	    }

	    if (event.event.type === "m.room.game") {
	    	console.log('Game has', event.event.content.players.length, 'players');
	    	render(event.event.content.visible_state);
	    }
	});

	initClient();

	mxClient.startClient();

	mxClient.joinRoom(roomId).then(
		() => {
			gameRoomId = roomId;
		}
		,console.error
	);
}

function doAction(content) {
	mxClient.sendEvent(gameRoomId, 'm.room.game.action', content);
}

function initClient() {
	rl.on('line', (input) => {
		console.log(`You have selected: '${input}'`);

		var splitInput = input.split(/\s+/);
		var args = splitInput.slice(1);
		var cmd = splitInput[0];

		switch (cmd) {
			case 'move':
				doAction({
					verb: 'move',
					direction: args[0] // up, down, left, right
				});
			break;
			case 'pickup':
				doAction({verb: 'pickup'});
			break;
			case 'attack':
				doAction({verb: 'attack'});
			break;
			default:
				console.log('Unknown command');
			break;
		}
	});

	rl.on('SIGINT', () => {
	  rl.question('Are you sure you want to exit? ', (answer) => {
	    if (answer.match(/^y(es)?$/i)) process.exit();
	  });
	});
}

function render(visible_state) {

	visible_state.map.map((row, y) => {
		var healthEmoji = "😵😭😩😨😯🙁😕😐😬🙂😀";
		healthEmoji = "\uD83D\uDE35\uD83D\uDE2D\uD83D\uDE29\uD83D\uDE28\uD83D\uDE2F\uD83D\uDE41\uD83D\uDE15\uD83D\uDE10\uD83D\uDE2C\uD83D\uDE42\uD83D\uDE00";
		var characters = visible_state.characters.filter((c) => {
			return c.position.y === y;
		}).forEach((c) => {
			row = row.slice(0, c.position.x) + 
			      healthEmoji.slice(c.health * 2, c.health * 2 + 2) +
			      row.slice(c.position.x);
		});

		// Emoji take up two characters of horizontal space in MacOS terminal..

		row = row.replace(/([XV>< ])/g, '$1$1');

		row = row.replace(/([😵😭😩😨😯🙁😕😐😬🙂😀]) /g, '$1');

		// Replace gold with two characters to even things out
		row = row.replace(/G/g, 'Au');

		console.log(row);
	});
	console.log('Players: ', visible_state.characters.map((c) => c.id));

	if (visible_state.current_player === gameId) {
		console.log('Your turn!');
	} else {
		console.log('Current Player: ', visible_state.current_player);
	}
}

