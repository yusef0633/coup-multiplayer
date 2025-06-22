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

  function startCardDealingAnimation(players) {
    const deck = document.querySelector('.deck-stack');
    const positions = ['top', 'right', 'left', 'bottom'];
    players.forEach((player, i) => {
      const pos = player.id === socket.id ? 'bottom' : positions.shift();
      const target = document.querySelector(`#player-${pos} .player-cards`);
      if (target) target.innerHTML = '';

      for (let j = 0; j < 2; j++) {
        const card = document.createElement('div');
        card.className = 'player-card';
        card.textContent = '?';
        card.style.opacity = 0;
        setTimeout(() => {
          target.appendChild(card);
          card.animate([
            { transform: 'translateY(-20px)', opacity: 0 },
            { transform: 'translateY(0)', opacity: 1 }
          ], {
            duration: 400,
            fill: 'forwards'
          });
        }, 500 * (i * 2 + j));
      }
    });
  }

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
              socket.emit('flipCard', { index, lobbyCode });
            }, 300);
          }
        });
      }
      handContainer.appendChild(cardDiv);
    });
  }

  function renderOtherPlayers(players) {
    ['top', 'right', 'left'].forEach(p => document.getElementById(`player-${p}`).innerHTML = '');
    players.filter(p => p.id !== socket.id).forEach((player, index) => {
      const pos = ['top', 'right', 'left'][index % 3];
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
      document.getElementById(`player-${pos}`).appendChild(playerDiv);
    });
  }

  function updateTurnIndicator(name) {
    const self = playerNameInput.value.trim();
    turnIndicator.textContent = name === self ? "It's your turn!" : `Waiting for ${name}'s turn...`;
    turnIndicator.style.background = name === self ? "#2ecc71" : "#e74c3c";
  }

  socket.on('gameStarted', (data) => {
    lobbyContainer.style.display = 'none';
    gameContainer.style.display = 'block';
    playerNameDisplay.textContent = playerNameInput.value.trim();
    currentTurnPlayerId = data.currentTurnPlayerId;
    updateTurnIndicator(data.currentTurnPlayerName);
    renderOtherPlayers(data.players);
    setupActionButtons();
    startCardDealingAnimation(data.players);
  });

  socket.on('dealHand', (data) => {
    myCards = data.cards;
    myFlipped = data.flipped;
    myCoins = data.coins;
    playerCoinsDisplay.textContent = myCoins;
    renderHand();
  });
// Add this to your existing socket.io event listeners



socket.on('dealingCards', (data) => {
  // Clear existing cards
  handContainer.innerHTML = '';
  document.querySelectorAll('.player-cards').forEach(el => el.innerHTML = '');
  
  // Animate dealing to each player
  data.players.forEach((player, playerIndex) => {
    const position = player.id === socket.id ? 'bottom' : 
      ['top', 'right', 'left'][(playerIndex - (player.id === socket.id ? 0 : 1)) % 3];
    
    // Create card containers if needed
    if (position !== 'bottom') {
      const playerElement = document.getElementById(`player-${position}`);
      if (playerElement) {
        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'player-cards';
        cardsContainer.setAttribute('data-player', player.id);
        playerElement.appendChild(cardsContainer);
      }
    }

    // Animate each card
    setTimeout(() => {
      animateDealToPlayer(player.hand[0], position, 0);
      setTimeout(() => {
        animateDealToPlayer(player.hand[1], position, 1);
      }, 300);
    }, playerIndex * 600);
  });

  // Update game state after animations
  setTimeout(() => {
    myCards = data.players.find(p => p.id === socket.id).hand;
    myFlipped = [false, false];
    myCoins = 2;
    playerCoinsDisplay.textContent = myCoins;
    renderHand();
    deckCountDisplay.textContent = data.deckCount;
  }, data.players.length * 600 + 300);
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

  setupActionButtons();
});
