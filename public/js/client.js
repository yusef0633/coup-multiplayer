const socket = io();

const screens = {
 landing: document.getElementById('landing'),
 create: document.getElementById('create'),
 join: document.getElementById('join'),
 game: document.getElementById('game'),
};


function show(screen) {
 for (let key in screens) {
   screens[key].classList.add('hidden');
   screens[key].classList.remove('active');
 }
 screens[screen].classList.remove('hidden');
 screens[screen].classList.add('active');
}


const btnCreate = document.getElementById('btnCreate');
const btnJoin = document.getElementById('btnJoin');
const btnConfirmCreate = document.getElementById('btnConfirmCreate');
const btnConfirmJoin = document.getElementById('btnConfirmJoin');
const btnStart = document.getElementById('btnStart');


const createdCode = document.getElementById('createdCode');
const createName = document.getElementById('createName');
const createPlayers = document.getElementById('createPlayers');


const joinCode = document.getElementById('joinCode');
const joinName = document.getElementById('joinName');
const joinPlayers = document.getElementById('joinPlayers');


let currentLobby = '';
let player = '';


btnCreate.onclick = () => {
 currentLobby = Math.random().toString(36).substring(2, 8).toUpperCase();
 createdCode.textContent = currentLobby;
 show('create');
};


btnJoin.onclick = () => show('join');


btnConfirmCreate.onclick = () => {
 player = createName.value.trim();
 if (!player) return alert("Enter your name.");
 socket.emit('createLobby', currentLobby, player);
};


btnConfirmJoin.onclick = () => {
 currentLobby = joinCode.value.trim().toUpperCase();
 player = joinName.value.trim();
 if (!player || !currentLobby) return alert("Enter lobby code and name.");
 socket.emit('joinLobby', currentLobby, player);
};


btnStart.onclick = () => {
 socket.emit('startGame', currentLobby);
};


document.querySelectorAll('.back').forEach(btn => {
 btn.onclick = () => location.reload();
});


socket.on('lobbyCreated', (code) => {
 console.log('Lobby created:', code);
});


socket.on('lobbyUpdate', (players) => {
 const list = screens.create.classList.contains('active') ? createPlayers : joinPlayers;
 list.innerHTML = '';
 players.forEach(p => {
   const li = document.createElement('li');
   li.textContent = p.name;
   list.appendChild(li);
 });
});


socket.on('gameStarted', () => {
 show('game');
});


socket.on('lobbyError', msg => {
 alert(msg);
});
