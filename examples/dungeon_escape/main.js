var MXGame = require('../../MXGame.js');

var dungeonEscape = new MXGame('config.yaml');

var Character = function (userId, game) {
	this.game = game;
	this.userId = userId;
	this.direction = 'down'; // 'up' | 'right' | 'down' | 'left'
	this.position = {x : 0, y : 0};
	this.gold = 0;
	this.health = 10;
	this.dead = false;

	var deltas = {
		up: {x : 0, y : -1},
		right: {x : 1, y : 0},
		down: {x : 0, y : 1},
		left: {x : -1, y : 0}
	}

	// movement =  'up' | 'right' | 'down' | 'left'
	this.move = function(movement) {
		if (this.dead) {
			return;
		}
		if (!deltas[movement]) {
			throw new Error('Invalid movement');
		}
		var delta = deltas[movement];
		this.direction = movement;
		this.position = this.game.getDeltaPos(this.position, delta);
	}

	this.increaseGold = function(n) {
		if (this.dead) {
			return;
		}
		this.gold += n;
	}

	this.changeHealth = function(n) {
		this.health += n;

		if (this.health === 0) {
			this.dead = true;
		}
	}

	this.isInFrontOf = function(character) {
		var front = {x: character.position.x, y: character.position.y};
		var del = deltas[character.direction];
		front.x += del.x;
		front.y += del.y;
		return this.atPosition(front);
	}

	this.atPosition = function(pos) {
		return this.position.x === pos.x && this.position.y === pos.y;
	}
}
Character.prototype.serialise = function () {
	return {
		direction : this.direction,
		position : this.position,
		name : this.userId,
		health: this.health,
		id : this.userId
	}
}

// Event received by a bot from a non-player
dungeonEscape.onEvent = function(event) {
	// Automatically join a game
	dungeonEscape.joinGame(event.event.sender, event.event.room_id);
}

function generateMap() {
	var impassable = 'X#V><^';
	var width = 20;
	var height = 20;

	var tiles = [
		'XVVVVVVVVVVVVVVVVVVX',
		'>             G    <',
		'>                  <',
		'>                  <',
		'>                  <',
		'>      G           <',
		'>                  <',
		'>                  <',
		'>               G  <',
		'>                  <',
		'>                  <',
		'>                  <',
		'>  G               <',
		'>                  <',
		'>                  <',
		'>           G      <',
		'>                  <',
		'>                  <',
		'>                  <',
		'>                  <',
		'XXXXXXXXXXXXXXXXXXXX',
	];

	return {
		tileAt: function(position) {
			return tiles[position.y][position.x];
		},
		canStandOn: function(tile) {
			return impassable.indexOf(tile) === -1;
		},
		spawnPosition: function() {
			return {
				x: 2 + Math.round(Math.random() * (width - 4)),
				y: 2 + Math.round(Math.random() * (height - 4))
			}
		},
		setTileAt: function(position, tile) {
			var row = tiles[position.y];
			tiles[position.y] = row.slice(0, position.x) + tile + row.slice(position.x + 1);
		},
		serialise: function() {
			return tiles;
		}
	}
}

function _initialGameState() {
	var s = {
		current_player : null,
		characters : [],
		map : generateMap() 
	};

	s.serialise = function() {
		return {
			current_player : s.current_player,
			characters : s.characters.map(
				(c) => c.serialise()
			),
			map : s.map.serialise(),
		    isUnchanged : false // TODO : Hash and cache
		}
	}

	return s;
}

// Initialise game data
dungeonEscape.init = function(game) {
	game.state = _initialGameState();

	game.getDeltaPos = function (pos, delta) {
		if (!(typeof pos.x === 'number' && typeof pos.y === 'number')) {
			throw new Error('pos should have x and y components of type number');
		}
		if (!(typeof delta.x === 'number' && typeof delta.y === 'number')){
			throw new Error('delta should have x and y components of type number');
		}

		var newPos = {x: pos.x + delta.x, y: pos.y + delta.y};
		if (game.state.map.canStandOn(game.state.map.tileAt(newPos))) {
			return newPos;
		} else {
			return pos;
		}
	}
}

dungeonEscape.onPlayerJoin = function(game, userId) {

	// If no one is playing, this player becomes the current_player
	if (game.state.current_player === null) {
		game.state.current_player = userId;
		console.log('Current player now ' + userId);
	}

	var newCharacter = new Character(userId, game);

	newCharacter.position = game.state.map.spawnPosition();

	game.state.characters.push(newCharacter);
}

dungeonEscape.onAction = function(event, game) {
	// Action received from a player in room with state
	// This player has been put in m.room.game.players somehow

	//TODO: Check skey === sender ?
	//	sender cannot be faked, and only sender with skey=sender.user_id can
	//	edit event

	var playerId = event.getSender();

	if (!playerId) {
		throw new Error('Event does not have state key');
	}

	// Is it this players turn?
	if (game.state.current_player !== playerId) {
		console.log(
			'It is not ' + 
			playerId + 
			'\'s turn, it\'s ' + 
			game.state.current_player
		);
		return;
	}

	var userId = event.getSender();

	dungeonEscape._doAction(event.event.content, game, userId);
	console.log(game._players);
	var nextIx = (game._players.indexOf(userId) + 1) % game._players.length;
	var nextUserId = game._players[nextIx];

	console.log('Next player now ', nextUserId);
	game.state.current_player = nextUserId;

	this.updateView(event.event.room_id);
}

dungeonEscape._doAction = function(action, game, userId) {
	if (!action.verb) {
		throw new Error('Action (content) must have verb');
	}

	if (this._actionHandlers[action.verb]) {
		this._actionHandlers[action.verb](action, game, userId);
	} else {
		throw new Error('Handler for ' + action.verb + ' not defined');
	}
};

dungeonEscape._actionHandlers = {
	move: function(action, game, userId) {
		// Move a player
		if (!action.direction) {
			throw new Error('Need direction');
		}

		var character = game.state.characters.find((c) => c.userId === userId);

		if (!character) {
			throw new Error('Player has no character');
		}

		character.move(action.direction);
	},
	pickup: function(action, game, userId) {
		var character = game.state.characters.find((c) => c.userId === userId);

		if (!character) {
			throw new Error('Player has no character');
		}

		if (game.state.map.tileAt(character.position) === 'G') {
			game.state.map.setTileAt(character.position, ' ');
			character.increaseGold(1);
		}
		else {
			console.log('No gold to pickup');
		}
	},
	attack: function(action, game, userId) {
		// Atack a player in front of player
		var attacker = game.state.characters.find(
			(c) => {
				return c.userId === userId;
			}
		);

		if (!attacker) {
			throw new Error('Attacker not found');
		}

		var attacked = game.state.characters.find(
			(c) => {
				return c.isInFrontOf(attacker);
			}
		);

		if (attacked) {
			attacked.changeHealth(-1);
		} else {
			// Miss
		}
	},
	talk: this._talkHandle // Start talking to nearby players 
};

dungeonEscape.renderVisibleState = function(state) {
	// Display all state to players
	return state.serialise();
}

/// TESTS #####################################################

var SENDER = {
	userId: '@testUser:test.org',
	displayName: 'Test User'
};

var _testMemberEvent = () => {
	return {
		getSender : () => SENDER.userId,
		event : {
			type : 'm.room.member',
			content : {
			},
			room_id: '!testroom:matrix.org'
		},
		sender: SENDER,
		target: {
			userId: SENDER.userId
		}
	};
}

var _testMoveDownEvent = () => {
	return {
		getSender : () => SENDER.userId,
		event : {
			type : 'm.room.game.action',
			content : {
				game_room_id : '!testroom:matrix.org',
				verb : 'move',
				direction : 'down'
			},
			room_id: '!testroom:matrix.org'
		},
		sender: SENDER
	};
}

var _testPickupEvent = () => {
	return {
		getSender : () => SENDER.userId,
		event : {
			type : 'm.room.game.action',
			content : {
				game_room_id : '!testroom:matrix.org',
				verb : 'pickup'
			},
			room_id: '!testroom:matrix.org'
		},
		sender: SENDER
	};
}

dungeonEscape.test = function() {
	// Kill client
	this.mxClient = {
		sendEvent: (roomId, type, e) => {
			this.log.info('[TEST] Sending ' + type + ' event to ' + roomId);
			this.log.info(e);
			this.log.info('Characters: \n', e.visible_state.characters);
		}
	}

	// Send some test events to the server

	dungeonEscape._handleEvent(_testMemberEvent());
	dungeonEscape._handleEvent(_testMoveDownEvent());
	dungeonEscape._handleEvent(_testPickupEvent());
}

try {
	dungeonEscape.run({test: false});
} catch (e) {
	console.error(e);
}

