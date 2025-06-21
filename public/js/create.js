const socket = io();


function generateLobbyCode() {
 const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
 const numbers = '23456789';
 let code = '';
 for (let i = 0; i < 3; i++) {
   code += letters.charAt(Math.floor(Math.random() * letters.length));
 }
 for (let i = 0; i < 3; i++) {
   code += numbers.charAt(Math.floor(Math.random() * numbers.length));
 }
 return code;
}


document.addEventListener('DOMContentLoaded', () => {
 const lobbyCode = generateLobbyCode();
 document.getElementById('lobbyCode').textContent = lobbyCode;


 document.getElementById('createLobbyBtn').addEventListener('click', () => {
   const playerName = document.getElementById('playerName').value.trim();
   const errorMsg = document.getElementById('errorMsg');


   if (!playerName) {
     errorMsg.textContent = 'Please enter your name.';
     return;
   }


   errorMsg.textContent = '';
   socket.emit('createLobby', lobbyCode, playerName);
 });


 socket.on('lobbyCreated', (code) => {
   sessionStorage.setItem('lobbyId', code);
   sessionStorage.setItem('playerName', document.getElementById('playerName').value.trim());
   sessionStorage.setItem('isHost', 'true');  // Add this line
   window.location.href = 'lobby.html';
 });


 socket.on('lobbyError', (msg) => {
   document.getElementById('errorMsg').textContent = msg;
 });
});
