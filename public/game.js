document.addEventListener('DOMContentLoaded', () => {
  const socket = io();

  // DOM Elements
  const lobbyContainer = document.getElementById('lobby-container');
  const gameContainer = document.getElementById('game-container');
  const playerNameInput = document.getElementById('player-name');
  const lobbyCodeInput = document.getElementById('lobby-code');
  const createLobbyBtn = document.getElementById('create-lobby');
  const joinLobbyBtn = document.getElementById('join-lobby');
  const startGameBtn = document.getElementById('start-game');
  const playersList = document.getElementById('players-list');
  const lobbyMessage = document.getElementById('lobby-message');
  const handContainer = document.getElementById('hand');
  const turnIndicator = document.getElementById('turn-indicator');
  const playerNameDisplay = document.getElementById('player-name-display');
  const playerCoinsDisplay = document.getElementById('player-coins');

  // Game State
  let isHost = false;
  let currentPlayerId = null;
  let currentTurnPlayerId = null;
  let myCards = [];
  let myFlipped = [];
  let myCoins = 0;
  let lobbyCode = '';

  // Initialize Action Buttons
  const setupActionButtons = () => {
    const actionButtons = [
      'income', 'foreign-aid', 'coup', 'tax', 
      'assassinate', 'steal', 'exchange'
    ];

    actionButtons.forEach(btn => {
      const element = document.getElementById(`${btn}-btn`);
      if (element) {
        element.addEventListener('click', () => handleActionClick(btn));
      }
    });
  };

  const handleActionClick = (action) => {
    if (socket.id !== currentTurnPlayerId) {
      alert("It's not your turn!");
      return;
    }

    let target = null;

    // Actions that require a target
    if (['coup', 'assassinate', 'steal'].includes(action)) {
      const players = Array.from(document.querySelectorAll('.other-player'))
        .filter(p => !p.querySelector('.player-cards').classList.contains('exiled'));
      
      if (players.length === 0) {
        alert("No valid targets available!");
        return;
      }
      
      target = prompt(`Enter name of player to ${action}:`);
      if (!target) return;
    }

    socket.emit('takeAction', { 
      action: action.replace('-', '_'),
      target: target,
      lobbyCode: lobbyCode
    });
  };

  // Lobby Management
  createLobbyBtn.addEventListener('click', () => {
    const playerName = playerNameInput.value.trim();
    const code = lobbyCodeInput.value.trim().toUpperCase();

    if (!playerName || !code) {
      lobbyMessage.textContent = 'Please enter both name and lobby code';
      return;
    }

    lobbyMessage.textContent = 'Creating lobby...';
    lobbyCode = code;

    socket.emit('createLobby', code, playerName, (response) => {
      if (response.error) {
        lobbyMessage.textContent = response.error;
      } else {
        isHost = true;
        currentPlayerId = socket.id;
        lobbyMessage.textContent = `Lobby created with code ${code}`;
        showStartGameButtonIfReady();
      }
    });
  });

  joinLobbyBtn.addEventListener('click', () => {
    const playerName = playerNameInput.value.trim();
    const code = lobbyCodeInput.value.trim().toUpperCase();

    if (!playerName || !code) {
      lobbyMessage.textContent = 'Please enter both name and lobby code';
      return;
    }

    lobbyMessage.textContent = 'Joining lobby...';
    lobbyCode = code;

    socket.emit('joinLobby', code, playerName, (response) => {
      if (response.error) {
        lobbyMessage.textContent = response.error;
      } else {
        isHost = false;
        currentPlayerId = socket.id;
        lobbyMessage.textContent = `Joined lobby ${code}`;
      }
    });
  });

  socket.on('lobbyUpdate', (players) => {
    playersList.innerHTML = '';
    players.forEach(player => {
      const li = document.createElement('li');
      li.textContent = player.name + (player.id === socket.id ? ' (You)' : '');
      playersList.appendChild(li);
    });

    showStartGameButtonIfReady(players);
  });

  function showStartGameButtonIfReady(players = []) {
    if (!players.length) return;
    
    startGameBtn.style.display = isHost ? 'block' : 'none';
    startGameBtn.disabled = players.length < 2;
  }

  startGameBtn.addEventListener('click', () => {
    socket.emit('startGame', lobbyCode);
  });

  // Game Actions
  function renderHand() {
    handContainer.innerHTML = '';
    myCards.forEach((card, index) => {
      const cardDiv = document.createElement('div');
      cardDiv.classList.add('current-card');
      if (myFlipped[index]) {
        cardDiv.classList.add('flipped', 'revealed');
        cardDiv.innerHTML = `
          <div class="card-face card-front">${card}</div>
          <div class="card-face card-back" style="opacity:0.3">COUP</div>
        `;
      } else {
        cardDiv.innerHTML = `
          <div class="card-face card-back">COUP</div>
          <div class="card-face card-front">${card}</div>
        `;
        
        cardDiv.addEventListener('click', () => {
          if (socket.id === currentTurnPlayerId) {
            cardDiv.classList.add('flip-animation');
            setTimeout(() => {
              socket.emit('flipCard', { 
                index: index,
                lobbyCode: lobbyCode 
              });
            }, 300);
          }
        });
      }
      
      handContainer.appendChild(cardDiv);
    });
  }

  function renderOtherPlayers(players) {
    document.getElementById('player-top').innerHTML = '';
    document.getElementById('player-right').innerHTML = '';
    document.getElementById('player-left').innerHTML = '';
    
    const otherPlayers = players.filter(p => p.id !== socket.id);
    
    otherPlayers.forEach((player, index) => {
      const position = ['top', 'right', 'left'][index % 3];
      const playerDiv = document.createElement('div');
      playerDiv.className = 'player-info';
      playerDiv.innerHTML = `
        <div class="player-name">${player.name}</div>
        <div class="player-coins">Coins: ${player.coins}</div>
        <div class="player-cards" data-player="${player.id}"></div>
      `;
      
      const cardsContainer = playerDiv.querySelector('.player-cards');
      for (let i = 0; i < player.cardCount; i++) {
        const cardDiv = document.createElement('div');
        cardDiv.classList.add('player-card');
        cardDiv.textContent = '?';
        cardsContainer.appendChild(cardDiv);
      }
      
      document.getElementById(`player-${position}`).appendChild(playerDiv);
    });
  }

  function updateTurnIndicator(name) {
    if (name === playerNameInput.value.trim()) {
      turnIndicator.textContent = "It's your turn!";
      turnIndicator.style.background = "#2ecc71";
    } else {
      turnIndicator.textContent = `Waiting for ${name}'s turn...`;
      turnIndicator.style.background = "#e74c3c";
    }
  }

  // Socket Event Handlers
  socket.on('gameStarted', (data) => {
    lobbyContainer.style.display = 'none';
    gameContainer.style.display = 'block';
    playerNameDisplay.textContent = playerNameInput.value.trim();
    currentTurnPlayerId = data.currentTurnPlayerId;
    updateTurnIndicator(data.currentTurnPlayerName);
    renderOtherPlayers(data.players);
    setupActionButtons();
  });

  socket.on('dealHand', (data) => {
    myCards = data.cards;
    myFlipped = data.flipped;
    myCoins = data.coins;
    playerCoinsDisplay.textContent = myCoins;
    renderHand();
  });

  socket.on('cardFlipped', (data) => {
    if (data.playerId === socket.id) {
      myFlipped[data.index] = true;
      renderHand();
    } else {
      const playerElement = document.querySelector(`.player-cards[data-player="${data.playerId}"]`);
      if (playerElement) {
        const cardElement = playerElement.children[data.index];
        cardElement.textContent = data.card;
        cardElement.classList.add('flipped');
      }
    }
  });

  socket.on('actionResolved', (data) => {
    if (data.playerId === socket.id) {
      myCoins = data.coins;
      playerCoinsDisplay.textContent = myCoins;
    }
    // Update UI for other players
    const playerElement = document.querySelector(`.player-info [data-player="${data.playerId}"] .player-coins`);
    if (playerElement) {
      playerElement.textContent = `Coins: ${data.coins}`;
    }
  });

  socket.on('turnChanged', (data) => {
    currentTurnPlayerId = data.currentTurnPlayerId;
    updateTurnIndicator(data.currentTurnPlayerName);
    renderOtherPlayers(data.players);
  });

  socket.on('playerExiled', (playerName) => {
    alert(`${playerName} has been exiled!`);
  });

  socket.on('gameOver', (data) => {
    alert(`${data.winner} has won the game!`);
  });

  socket.on('actionError', (message) => {
    alert(message);
  });

  // Initialize the game
  setupActionButtons();
});