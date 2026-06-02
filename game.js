// Elementos da DOM
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const hud = document.getElementById("hud");
const missionText = document.getElementById("missionText");
const scoreText = document.getElementById("scoreText");
const inventoryBox = document.getElementById("inventoryBox");
const failReason = document.getElementById("failReason");

// Configurações
const gridSize = 16;
const cols = canvas.width / gridSize;
const rows = canvas.height / gridSize;

const blockTypes = [
    { color: "#ef4444", symbol: "A" }, // Vermelho
    { color: "#3b82f6", symbol: "B" }, // Azul
    { color: "#eab308", symbol: "C" }, // Amarelo
    { color: "#a855f7", symbol: "D" }  // Roxo
];

// Estado do Jogo
let snake = [];
let velocity = { x: 0, y: 0 };
let blocksOnMap = [];
let inventory = [];
let interactionsCompleted = 0;
const interactionsNeeded = 5; 
let gameLoop;
let isPlaying = false;

// Variáveis de Dificuldade e Recorde
let baseSpeed = 130; // Velocidade inicial (ms)
let currentSpeed = baseSpeed;
let bestScore = localStorage.getItem('snakeBotBestScore') || 0; // Puxa o recorde salvo no celular/PC

// Variáveis do Modo Infinito (Easter Egg)
let isInfiniteMode = false;
let tapCount = 0;

// Estado Matemático
let currentMode = "SIMPLES";
const combinationSize = 3;

// --- SISTEMA DE ÁUDIO (Sintetizador Web) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    if (type === 'eat') {
        // Som curto e agudo de coleta
        osc.type = 'square';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    } 
    else if (type === 'success') {
        // Som agudinho de pacote fechado com sucesso
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.2);
    }
    else if (type === 'error') {
        // Som grave de erro/batida
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.5);
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.5);
    }
}

// --- GERENCIAMENTO DE TELAS ---
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    if (screenId) {
        const screen = document.getElementById(screenId);
        if(screen) screen.classList.remove('hidden');
    }
}

function startGame() {
    showScreen(''); // Esconde todas as telas
    hud.classList.remove('hidden');
    
    snake = [{ x: Math.floor(cols/2), y: Math.floor(rows/2) }];
    velocity = { x: 0, y: -1 }; // Começa indo pra cima
    inventory = [];
    interactionsCompleted = 0;
    
    setupNewMission();
    
    isPlaying = true;
    if (gameLoop) clearInterval(gameLoop);
    gameLoop = setInterval(update, 120); // Velocidade do jogo
}

function endGame(reason, isVictory = false) {
    isPlaying = false;
    clearInterval(gameLoop);
    hud.classList.add('hidden');
    
    // --- NOVO: Salva o recorde no navegador se for a maior pontuação ---
    if (interactionsCompleted > bestScore) {
        bestScore = interactionsCompleted;
        localStorage.setItem('snakeBotBestScore', bestScore);
    }
    
    if (isVictory) {
        playSound('success'); 
        showScreen('victoryScreen');
    } else {
        playSound('error'); 
        failReason.innerText = reason;
        showScreen('gameOverScreen');
        
    }
}

// --- LÓGICA MATEMÁTICA E MISSÕES ---
function setupNewMission() {
    inventory = [];
    currentMode = Math.random() > 0.5 ? "SIMPLES" : "REPETICAO";
    
    if (currentMode === "SIMPLES") {
        missionText.innerText = "Missão: Combinação Simples (Colete 3 Diferentes)";
        missionText.style.color = "#60a5fa";
    } else {
        missionText.innerText = "Missão: Combinação c/ Repetição (Colete 3 Iguais ou Não)";
        missionText.style.color = "#f472b6";
    }
    
    updateHUD();
    spawnBlocks();
}

function spawnBlocks() {
    blocksOnMap = [];
    for(let i = 0; i < 5; i++) {
        let type = blockTypes[Math.floor(Math.random() * blockTypes.length)];
        blocksOnMap.push({
            x: Math.floor(Math.random() * cols),
            y: Math.floor(Math.random() * rows),
            color: type.color,
            symbol: type.symbol
        });
    }
}

function processCollectedBlock(colorCollected) { // Agora recebe a cor
    // Verifica pela cor em vez da letra
    if (currentMode === "SIMPLES" && inventory.includes(colorCollected)) {
        endGame("Erro Matemático: Em uma Combinação Simples, as CORES não podem se repetir!");
        return;
    }

    inventory.push(colorCollected);
    updateHUD();

    if (inventory.length === combinationSize) {
        interactionsCompleted++;

        currentSpeed = Math.max(60, baseSpeed - (interactionsCompleted * 5)); // Fica mais rápido, mas tem um limite (60ms)
        clearInterval(gameLoop);
        gameLoop = setInterval(update, currentSpeed);
        
        if (!isInfiniteMode && interactionsCompleted >= interactionsNeeded) {
            endGame("", true); 
        } else {
            playSound('success'); 
            canvas.style.borderColor = "#fbbf24";
            setTimeout(() => canvas.style.borderColor = "#10b981", 300);
            setupNewMission(); 
        }
    } else {
        playSound('eat'); 
        spawnBlocks(); 
    }
}

function updateHUD() {
    if (isInfiniteMode) {
        scoreText.innerText = `Pacotes: ${interactionsCompleted} | Recorde: ${bestScore}`;
    } else {
        scoreText.innerText = `${interactionsCompleted}/${interactionsNeeded}`;
    }
    
    let invDisplay = "";
    for (let i = 0; i < combinationSize; i++) {
        if (inventory[i]) {
            // Desenha o bloco com a cor real que o jogador comeu
            invDisplay += `<span style="color: ${inventory[i]}; text-shadow: 1px 1px 2px #000; font-size: 16px;">[■]</span> `;
        } else {
            // Espaço vazio
            invDisplay += `<span style="color: #ffffff;">[ ]</span> `;
        }
    }
    
    // IMPORTANTE: Mudamos de innerText para innerHTML para as cores funcionarem!
    inventoryBox.innerHTML = invDisplay; 
}

// --- LOOP DO JOGO ---
function update() {
    if (!isPlaying) return;

    const head = { x: snake[0].x + velocity.x, y: snake[0].y + velocity.y };

    if (head.x < 0 || head.x >= cols || head.y < 0 || head.y >= rows) {
        endGame("Falha Crítica: Colisão estrutural (Parede).");
        return;
    }

    for (let part of snake) {
        if (head.x === part.x && head.y === part.y) {
            endGame("Falha Crítica: Corrompimento de dados (Bateu no próprio corpo).");
            return;
        }
    }

    snake.unshift(head);

    let ateBlock = false;
    for (let i = 0; i < blocksOnMap.length; i++) {
        if (head.x === blocksOnMap[i].x && head.y === blocksOnMap[i].y) {
            processCollectedBlock(blocksOnMap[i].color);
            blocksOnMap.splice(i, 1);
            ateBlock = true;
            break;
        }
    }

    if (!ateBlock) {
        snake.pop(); 
    }

    draw();
}

function draw() {
    // Fundo escuro
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // --- NOVO: Desenha a Grade (Grid) Estilo Matriz ---
    ctx.strokeStyle = "rgba(51, 65, 85, 0.5)"; // Cor da linha bem transparente
    ctx.lineWidth = 1;
    for (let x = 0; x <= canvas.width; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y <= canvas.height; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    // Blocos
    blocksOnMap.forEach(block => {
        ctx.fillStyle = block.color;
        ctx.fillRect(block.x * gridSize + 2, block.y * gridSize + 2, gridSize - 4, gridSize - 4);
    });

    // Snake
    snake.forEach((part, index) => {
        ctx.fillStyle = index === 0 ? "#10b981" : "#059669";
        ctx.fillRect(part.x * gridSize + 1, part.y * gridSize + 1, gridSize - 2, gridSize - 2);
    });
}

// --- CONTROLES E BOTÕES ---

const tituloPrincipal = document.querySelector('#startScreen h1');
tituloPrincipal.addEventListener('click', () => {
    if (isInfiniteMode) return; // Se já ativou, não faz nada
    
    tapCount++;
    if (tapCount >= 5) {
        ativarModoInfinito();
        tapCount = 0; // Reseta o contador
    }
});

function ativarModoInfinito() {
    isInfiniteMode = true;
    playSound('success'); 
    
    const titulo = document.querySelector('#startScreen h2');
    titulo.innerText = "Operação: INFINITA (Desbloqueada!)";
    titulo.style.color = "#a855f7"; 
    
    const texto = document.querySelector('#startScreen p');
    texto.innerHTML = "<strong>Modo Infinito:</strong> O limite de 5 pacotes foi desativado. Sobreviva até preencher todo o sistema e continue resolvendo as combinações. Boa sorte!";
}

window.addEventListener('keydown', e => {
    switch (e.key) {
        case 'ArrowUp': if (velocity.y === 0) velocity = { x: 0, y: -1 }; break;
        case 'ArrowDown': if (velocity.y === 0) velocity = { x: 0, y: 1 }; break;
        case 'ArrowLeft': if (velocity.x === 0) velocity = { x: -1, y: 0 }; break;
        case 'ArrowRight': if (velocity.x === 0) velocity = { x: 1, y: 0 }; break;
    }
    
});

let touchStartX = 0;
let touchStartY = 0;

window.addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
}, {passive: false});

window.addEventListener('touchmove', e => {
    if(isPlaying) e.preventDefault(); 
}, {passive: false});

window.addEventListener('touchend', e => {
    if(!isPlaying) return;
    let endX = e.changedTouches[0].screenX;
    let endY = e.changedTouches[0].screenY;
    
    let diffX = endX - touchStartX;
    let diffY = endY - touchStartY;

    if (Math.abs(diffX) > 30 || Math.abs(diffY) > 30) {
        if (Math.abs(diffX) > Math.abs(diffY)) {
            if (diffX > 0 && velocity.x === 0) velocity = { x: 1, y: 0 };
            else if (diffX < 0 && velocity.x === 0) velocity = { x: -1, y: 0 };
        } else {
            if (diffY > 0 && velocity.y === 0) velocity = { x: 0, y: 1 };
            else if (diffY < 0 && velocity.y === 0) velocity = { x: 0, y: -1 };
        }
    }
});

// Eventos dos Botões (Correção do erro de Reference)
document.getElementById('btnProximo')?.addEventListener('click', () => {
    showScreen('tutorialScreen');
});

document.getElementById('btnIniciar')?.addEventListener('click', () => {
    startGame();
});

document.getElementById('btnReiniciar1')?.addEventListener('click', () => {
    showScreen('startScreen');
});

document.getElementById('btnReiniciar2')?.addEventListener('click', () => {
    showScreen('startScreen');
});