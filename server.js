const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

const PORT = process.env.PORT || 3000;

const lobbies = {};
const INITIAL_DECK = [
  'Duke', 'Duke', 'Duke',
  'Assassin', 'Assassin', 'Assassin',
  'Captain', 'Captain', 'Captain',
  'Ambassador', 'Ambassador', 'Ambassador',
  'Contessa', 'Contessa', 'Contessa'
];

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Lobby Management
  socket.on('createLobby', (code, playerName, callback) => {
    if (lobbies[code]) {
      callback({ error: 'Lobby code already exists' });
      return;
    }

    lobbies[code] = {
      players: [{ 
        id: socket.id, 
        name: playerName, 
        hand: [], 
        coins: 2, 
        flipped: [], 
        cardCount: 0 
      }],
      started: false,
      deck: [],
      discardPile: [],
      turnIndex: 0,
      currentAction: null,
      code: code
    };

    socket.join(code);
    callback({});
    io.to(code).emit('lobbyUpdate', lobbies[code].players);
  });

  socket.on('joinLobby', (code, playerName, callback) => {
    const lobby = lobbies[code];
    if (!lobby) {
      callback({ error: 'Lobby does not exist' });
      return;
    }
    if (lobby.started) {
      callback({ error: 'Game already started' });
      return;
    }
    if (lobby.players.find(p => p.name === playerName)) {
      callback({ error: 'Name already taken in lobby' });
      return;
    }

    lobby.players.push({ 
      id: socket.id, 
      name: playerName, 
      hand: [], 
      coins: 2, 
      flipped: [], 
      cardCount: 0 
    });
    socket.join(code);
    callback({});
    io.to(code).emit('lobbyUpdate', lobby.players);
  });

  socket.on('startGame', (code) => {
    const lobby = lobbies[code];
    if (!lobby || !lobby.players.some(p => p.id === socket.id)) return;

    lobby.started = true;
    lobby.deck = shuffle([...INITIAL_DECK]);
    
    lobby.players.forEach(player => {
      player.hand = lobby.deck.splice(0, 2);
      player.flipped = [false, false];
      player.cardCount = 2;
      io.to(player.id).emit('dealHand', {
        cards: player.hand,
        coins: player.coins,
        flipped: player.flipped
      });
    });

    lobby.turnIndex = 0;
    const currentPlayer = lobby.players[lobby.turnIndex];

    io.to(code).emit('gameStarted', {
      currentTurnPlayerId: currentPlayer.id,
      currentTurnPlayerName: currentPlayer.name,
      players: lobby.players.map(p => ({
        id: p.id,
        name: p.name,
        coins: p.coins,
        cardCount: p.cardCount
      }))
    });
  });

  // Game Actions
  socket.on('takeAction', (data) => {
    const lobby = lobbies[data.lobbyCode];
    if (!lobby) return;

    const player = lobby.players.find(p => p.id === socket.id);
    if (!player || lobby.players[lobby.turnIndex].id !== socket.id) {
      io.to(socket.id).emit('actionError', "It's not your turn!");
      return;
    }

    // Validate action
    if (data.action === 'coup' && player.coins < 7) {
      io.to(socket.id).emit('actionError', "You need 7 coins to launch a coup!");
      return;
    }

    if (data.action === 'assassinate' && player.coins < 3) {
      io.to(socket.id).emit('actionError', "You need 3 coins to assassinate!");
      return;
    }

    // Force coup if player has 10+ coins
    if (player.coins >= 10 && data.action !== 'coup') {
      io.to(socket.id).emit('actionError', "You must launch a Coup when you have 10+ coins!");
      return;
    }

    // Store current action
    lobby.currentAction = {
      playerId: socket.id,
      action: data.action,
      target: data.target,
      resolved: false
    };

    // Handle immediate actions
    switch(data.action) {
      case 'income':
        player.coins += 1;
        io.to(lobby.code).emit('actionResolved', {
          playerId: player.id,
          coins: player.coins,
          action: 'income'
        });
        nextTurn(lobby);
        break;
        
      case 'foreign_aid':
        // Requires potential block by Duke
        io.to(lobby.code).emit('actionAttempted', {
          playerId: socket.id,
          playerName: player.name,
          action: 'foreign_aid'
        });
        break;
        
      case 'tax':
        player.coins += 3;
        io.to(lobby.code).emit('actionResolved', {
          playerId: player.id,
          coins: player.coins,
          action: 'tax'
        });
        nextTurn(lobby);
        break;
        
      default:
        // Other actions require target selection
        io.to(lobby.code).emit('actionAttempted', {
          playerId: socket.id,
          playerName: player.name,
          action: data.action,
          target: data.target
        });
    }
  });

  socket.on('flipCard', (data) => {
    const lobby = lobbies[data.lobbyCode];
    if (!lobby) return;

    const player = lobby.players.find(p => p.id === socket.id);
    if (!player || player.flipped[data.index]) return;

    player.flipped[data.index] = true;
    player.cardCount -= 1;
    
    // Add to discard pile
    lobby.discardPile.push(player.hand[data.index]);
    
    io.to(data.lobbyCode).emit('cardFlipped', {
      playerId: socket.id,
      index: data.index,
      card: player.hand[data.index]
    });

    // Check if player is out of the game
    if (player.cardCount <= 0) {
      player.coins = 0;
      io.to(data.lobbyCode).emit('playerExiled', player.name);
      
      // Check if game is over
      const activePlayers = lobby.players.filter(p => p.cardCount > 0);
      if (activePlayers.length === 1) {
        io.to(data.lobbyCode).emit('gameOver', {
          winner: activePlayers[0].name
        });
      }
    }
  });

  // Helper Functions
  function nextTurn(lobby) {
    do {
      lobby.turnIndex = (lobby.turnIndex + 1) % lobby.players.length;
    } while (lobby.players[lobby.turnIndex].cardCount <= 0);
    
    const currentPlayer = lobby.players[lobby.turnIndex];
    
    io.to(lobby.code).emit('turnChanged', {
      currentTurnPlayerId: currentPlayer.id,
      currentTurnPlayerName: currentPlayer.name,
      players: lobby.players.map(p => ({
        id: p.id,
        name: p.name,
        coins: p.coins,
        cardCount: p.cardCount
      }))
    });
  }

  socket.on('disconnect', () => {
    for (const code in lobbies) {
      const lobby = lobbies[code];
      const idx = lobby.players.findIndex(p => p.id === socket.id);
      if (idx !== -1) {
        lobby.players.splice(idx, 1);
        io.to(code).emit('lobbyUpdate', lobby.players);

        if (lobby.players.length === 0) {
          delete lobbies[code];
        }
        break;
      }
    }
  });
});

http.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});