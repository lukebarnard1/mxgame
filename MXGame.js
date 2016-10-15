
const yaml = require('js-yaml');
const fs = require('fs');
const crypto = require('crypto');
const matrixSDK = require("matrix-js-sdk");

const MXGameInstance = require("./MXGameInstance.js");

var MXGame = function(config_file) {
    this.config = yaml.safeLoad(fs.readFileSync(config_file, 'utf8'));

    //TODO: Should really run as an AS registered with a HS
    this.mxClient = matrixSDK.createClient(this.config.client);

    this._handleEvent = _handleEvent;
    this._userGames = _userGames;

    // $roomId -> MXGameInstance
    this._games = {};
}

// Get the games this member is playing in
var _userGames = function(member) {
    return Object.keys(this._games).filter((roomId) => {
        return this._games[roomId].isPlaying(member);
    }).map((roomId) => this._games[roomId]);
}


var _handleEvent = function(event) {
    // Ignore old messages
    if (event.event.origin_server_ts < Date.now() - 2000) {
        return;
    }

    var senderUserId = event.getSender();

    // Ignore messages sent by this bot
    if (senderUserId === this.config.client.userId) {
        return;
    }

    if (event.event.type === 'm.room.member') {
        this.log.info(event.target.userId);
    }

    // The gameRoomId could be a room that the player
    //  is not even in.
    var gameRoomId = event.event.content.game_room_id || 
                 event.event.room_id;
    var game = this._games[gameRoomId];

    if (game) {
        this.onEvent(event, game);

        if (!game.isPlaying(senderUserId)) {
            console.log(senderUserId, 'not playing')
            return;
        }
        
        this.onAction(event, game);
        return;
    }

    if (event.event.type !== 'm.room.game.action') {
        return;
    }

    if (this.config.automaticNewGames) {
        console.log('Automatically created new game');
        game = new MXGameInstance();

        this.init(game);

        this._games[gameRoomId] = game;

        this.joinGame(senderUserId, event.event.room_id);
        this.onAction(event, game);

        return;
    }
}

MXGame.prototype.run = function(opts) {

    // Just run a test
    if (opts.test && typeof this.test === 'function') {
        this.test();
        return;
    }

    this.mxClient.on("Room.timeline", function(event, room, toStartOfTimeline) {
        if (toStartOfTimeline) {
            return; // ignore paginated results
        }

        this._handleEvent(event);
    }.bind(this));
    
    // Auto join rooms
    this.mxClient.on("RoomMember.membership", function(event, member) {
        if (member.membership === "invite" && 
            member.userId === this.config.client.userId) {
                this.mxClient.joinRoom(member.roomId).done(function() {
                this.log("Auto-joined %s", member.roomId);
                });
        }
    }.bind(this));

    this.mxClient.startClient();
}

MXGame.prototype.log = {
    info: console.info,
    error: console.error,
    warn: console.warn,
}

// In future, onAction will be called for this player
MXGame.prototype.joinGame = function(userId, roomId) {
    // TODO: Auto create should go here(?)
    var game = this._games[roomId];

    if (!this._games[roomId]) {
        throw new Error('Tried to join non-existant game');
    }

    if (game.isPlaying(userId)) {
        console.log(`${userId} is already playing game in ${roomId}`);
        return;
    }

    game.addPlayer(userId);

    this.onPlayerJoin(game, userId);
}

// Called when a game instance is first created
MXGame.prototype.init = function(game) {
    // Initialise a game
}

// Called when a player joins a game
MXGame.onPlayerJoin = function(game, userId) {

}

// Event received by a bot from a non-player
MXGame.prototype.onEvent = function(e) {

}

MXGame.prototype.onAction = function(event, game) {
	// Action received from a player in room with state
	// This player has been put in m.room.game.players somehow
}

// Send an updated visible state into the room
MXGame.prototype.updateView = function(roomId) {
    var inst = this._games[roomId];

    if (!inst) {
        throw new Error("Game does not exist");
    }

    var visibleState = this.renderVisibleState(inst.state);

    if (visibleState.isUnchanged) {
        // state already sent
        console.log('Not sending visible state - already sent');
        return;
    }

    this.mxClient.sendEvent(
        roomId, 
        "m.room.game",
        {
            players: inst._players,
            visible_state: visibleState
        }
    );
}

MXGame.prototype.renderVisibleState = function(state) {
    // By default, render all state to the clients
    state.isUnchanged = false;
	return state;
}

module.exports = MXGame;