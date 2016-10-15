
const MXGameInstance = function() {
	this._players = [];// :userId[]
	this.state = {};
}

MXGameInstance.prototype.addPlayer = function(player) {
	this._players.push(player);
};

MXGameInstance.prototype.isPlaying = function(userId) {
	return this._players.some(
		(id) => id === userId
	);
};

module.exports = MXGameInstance;