 const socket = io();


document.addEventListener('DOMContentLoaded', () => {
const lobbyId = sessionStorage.getItem('lobbyId');
const playerName = sessionStorage.getItem('playerName');
const isHost = sessionStorage.getItem('isHost') === 'true';




if (!lobbyId || !playerName) {
  alert('Missing lobby info, redirecting to home.');
  window.location.href = 'index.html';
  return;
}




document.getElementById('lobbyCodeDisplay').textContent = lobbyId;




// Rejoin the lobby after page reload
if (isHost) {
  socket.emit('createLobby', lobbyId, playerName);
} else {
  socket.emit('joinLobby', lobbyId, playerName);
}




const playerList = document.getElementById('playerList');
const playerCount = document.getElementById('playerCount');
const hostControls = document.getElementById('hostControls');
const startGameBtn = document.getElementById('startGameBtn');




socket.on('lobbyUpdate', (players) => {
  playerList.innerHTML = '';
  playerCount.textContent = players.length;




  players.forEach((player, index) => {
    const li = document.createElement('li');
    li.textContent = player.name;
    if (player.id === socket.id) li.textContent += ' (You)';
    if (index === 0) li.textContent += ' [Host]';
    playerList.appendChild(li);
  });




  // Only show host controls if this player is the host
  if (players[0]?.id === socket.id) {
    hostControls.style.display = 'block';
    startGameBtn.disabled = players.length < 2;
  } else {
    hostControls.style.display = 'none';
  }
});




socket.on('lobbyError', (msg) => {
  alert(msg);
  window.location.href = 'index.html';
});




startGameBtn.addEventListener('click', () => {
  socket.emit('startGame', lobbyId);
});
socket.on('gameStarted', () => {
window.location.href = '/game.html';
});




socket.on('gameStarted', () => {
  alert('Game is starting!');
  // Here you would implement your game logic or redirection
});
});
