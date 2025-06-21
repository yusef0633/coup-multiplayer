 const socket = io();




document.addEventListener('DOMContentLoaded', () => {
document.getElementById('joinLobbyBtn').addEventListener('click', () => {
  const lobbyCode = document.getElementById('lobbyCode').value.trim().toUpperCase();
  const playerName = document.getElementById('playerName').value.trim();
  const errorMsg = document.getElementById('errorMsg');




  if (lobbyCode.length !== 6) {
    errorMsg.textContent = 'Lobby code must be 6 characters.';
    return;
  }
  if (!playerName) {
    errorMsg.textContent = 'Please enter your name.';
    return;
  }




  errorMsg.textContent = '';
  socket.emit('joinLobby', lobbyCode, playerName);
});




socket.on('joinLobbySuccess', (lobbyCode) => {
  sessionStorage.setItem('lobbyId', lobbyCode);
  sessionStorage.setItem('playerName', document.getElementById('playerName').value.trim());
  sessionStorage.setItem('isHost', 'false');
  window.location.href = 'lobby.html';
});




socket.on('lobbyError', (msg) => {
  document.getElementById('errorMsg').textContent = msg;
});
});
