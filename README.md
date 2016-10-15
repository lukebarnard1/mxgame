
# Hack for TAD Hack

So far I've made a very simple underlying library to build distributed state-based games (see MXGame.js) and a single example under examples/dungeon_escape.

## Dungeon Escape example
Run `node examples/dungeon_escape/main.js` to start the game. This will use config.yaml which should be at the top level of your copy of this repo (`cp config.sample.yaml config.yaml`). Join the game by running the example client: `node examples/dungeon_escape/client.js`. The following commands are possible:
 - move [up|down|left|right]
 - pickup 
 - attack

Move will change the position of your character in the game. pickup will pick gold up from the map if your character is at the same position as some gold. attack will cause your character to attack the character in front of yours (direction of characters is based on movement; if you move left, you'll be pointing left).

Players must take turns, which are done on a round-robin basis.

Continue reading for the initial design of the framework underlying this library. Please note, this may not be accurate due to present hacking (for TAD Hack https://matrix.to/#/#tadhack:matrix.org):

# Matrix Game

So the bot is the maintainer of the visible state, and should therefore be the only one with write access.

With that assumption, the state that should be visible to all players should be kept in

```JSON
	m.room.game : {
		content: {
			players: [list of player ids],
			visible_state: {
				...
			}
		},
	}
```

Whenever something happens in the game, m.room.game will be updated by the game bot. There will be some things that every game will need, like the ability of a player to join the game. The ability of someone to join will be governed by the bot. Players with compatible clients will be able to send a game action, which will represent some UI interaction:

```JSON
	m.room.game.action : {
		sender:  '@player:matrix.org',
		content: {
			game_room_id: '!thegameroom:matrix.org',
			...
		}
	}
```

If the bot receives these actions, it may update the game state for the specified game room accordingly. Sending an action to a bot can be done by sending an action to any room that the bot is in, but it is recommended that this is done by sending private actions to the bot within a private room. If an action is sent within a game room itself, the action will be public to all other matrix users in that room.

## Bot Presence
The presence of a gaming bot in the room is not enough to indicate that there is a game in the room to join. There must be some game state in the room.

## Game Architecture

### Game-side
A single game bot is capable of maintaining several games concurrently, and even persisting games across power cycles if it is implemented to do so. The game state is kept with the bot, which runs the 'server-side' of the games it is maintaining. 

This side of the architecture could be seen as a single function that accepts an event occuring in a room that the bot is in, and that updates the internal game state.

```event -> void```

Another function is then dedicated "re-rendering" the visible state in the matrix room. This is called whenever the game state changes, with the game state as input and returns the visible state.

```game_state -> visible_state```

### Client-side
The clients using matrix represent the 'client-side' of the games being played currently. Matrix users can log in using their clients and then somehow specify that they wish to join a game, possibly by sending an action to the responsible bot or by simply joining a room. This can be seen as a function that takes visible state and displays the game accordingly.

```visible_state -> void```

NOTES:
 - The client and game do not need to be bundled into one package - they can exist totally seperately.
 - There should be options for other languages, not just javascript. So in other words, this project should have 'js' in the name.

