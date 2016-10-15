var MXGame = require('./MXGame.js');

var myGame = new MXGame('config.yaml');

// Event received by a bot from a non-player
myGame.onEvent = function(event) {
	// Automatically join a game
	if (event.event.type === "m.room.member") {
		myGame.joinGame(event.sender, event.event.room_id);
	}
}

function _initialGameState() {
	return {
		current_player : null
	}
}

// Initialise game data
myGame.init = function(game) {
	game.state = _initialGameState();
}

myGame.onPlayerJoin = function(game, player) {

	// If no one is playing, this player becomes the current_player
	if (game.state.current_player === null) {
		game.state.current_player = player.userId;
	}
}

myGame.onAction = function(event, game) {
	// Action received from a player in room with state
	// This player has been put in m.room.game.players somehow

	//TODO: Check skey === sender ?
	//	sender cannot be faked, and only sender with skey=sender.user_id can
	//	edit event

	var playerId = event.statekey;

	// Is it this players turn?
	if (game.state.current_player !== event.statekey) {
		console.log('Not your turn');
		return;
	}

	// Do game-specific things
	// ...


	this.updateView(event.event.room_id);
}

myGame.renderVisibleState = function(state) {
	// Display all state to players
	return state;
}


myGame.run();