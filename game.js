const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const hud = document.getElementById("hud");
const missionText = document.getElementById("missionText");
const scoreText = document.getElementById("scoreText");
const inventoryBox = document.getElementById("inventoryBox");
const failReason = document.getElementById("failReason");

const gridSize = 16;
const cols = canvas.width / gridSize;
const rows = canvas.height / gridSize;

const blockTypes = [
    { color: "#ef4444", symbol: "A" },
    { color: "#3b82f6", symbol: "B" },
    { color: "#eab308", symbol: "C" },
    { color: "#a855f7", symbol: "D" }
];

let snake = [];
let velocity = { x: 0, y: 0 };
let blocksOnMap = [];
let inventory = [];
let interactionsCompleted = 0;
const interactionsNeeded = 5; 
let gameLoop;
let isPlaying = false;

let baseSpeed = 130;
let currentSpeed = baseSpeed;
let bestScore = localStorage.getItem('snakeBotBestScore') || 0;

let isInfiniteMode = false;
let tapCount = 0;

let currentMode = "SIMPLES";
let combinationSize = 2;

function factorial(n) {
    if (n === 0 || n === 1) return 1;
    let result = 1;
    for (let i = 2; i <= n; i++) result *= i;
    return result;
}

function calcularPossibilidades() {
    let n = blockTypes.length;
    let p = combinationSize;
    
    if (currentMode === "SIMPLES") {
        return factorial(n) / (factorial(p) * factorial(n - p));
    } else {
        return factorial(n + p - 1) / (factorial(p) * factorial(n - 1));
    }
}

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

let bgmInterval = null;

function startBGM() {
    if (bgmInterval) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    let noteIndex = 0;
    const notes = [110, 110, 220, 110, 146.83, 110, 164.81, 110];
    
    bgmInterval = setInterval(() => {
        if (!isPlaying) return;
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(notes[noteIndex], audioCtx.currentTime);
        
        gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
        
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
        
        noteIndex = (noteIndex + 1) % notes.length;
    }, 200);
}

function stopBGM() {
    if (bgmInterval) {
        clearInterval(bgmInterval);
        bgmInterval = null;
    }
}

function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    if (type === 'eat') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    } 
    else if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.2);
    }
    else if (type === 'error') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.5);
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.5);
    }
}

let particles = [];

function spawnParticles(x, y, color) {
    for (let i = 0; i < 15; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6,
            life: 1,
            color: color
        });
    }
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    if (screenId) {
        const screen = document.getElementById(screenId);
        if(screen) screen.classList.remove('hidden');
    }
}

function startGame() {
    showScreen('');
    hud.classList.remove('hidden');
    
    snake = [{ x: Math.floor(cols/2), y: Math.floor(rows/2) }];
    velocity = { x: 0, y: -1 };
    inventory = [];
    interactionsCompleted = 0;
    particles = [];
    
    setupNewMission();
    
    isPlaying = true;
    startBGM();
    
    if (gameLoop) clearInterval(gameLoop);
    gameLoop = setInterval(update, 120);
}

function endGame(reason, isVictory = false) {
    isPlaying = false;
    stopBGM();
    clearInterval(gameLoop);
    hud.classList.add('hidden');
    
    if (interactionsCompleted > bestScore) {
        bestScore = interactionsCompleted;
        localStorage.setItem('snakeBotBestScore', bestScore);
    }
    
    if (isVictory) {
        playSound('success'); 
        showScreen('victoryScreen');
    } else {
        playSound('error'); 
        
        const container = document.getElementById('gameContainer');
        if (container) {
            container.style.transform = "translate(5px, 5px)";
            setTimeout(() => container.style.transform = "translate(-5px, -5px)", 50);
            setTimeout(() => container.style.transform = "translate(5px, -5px)", 100);
            setTimeout(() => container.style.transform = "translate(0, 0)", 150);
        }

        let possibilidades = calcularPossibilidades();
        let tipoCombo = currentMode === "SIMPLES" ? "Simples" : "com Repetição";
        
        let n = blockTypes.length;
        let p = combinationSize;
        let formulaText = "";
        
        if (currentMode === "SIMPLES") {
            formulaText = `Fórmula: C(${n}, ${p}) = ${n}! / (${p}! * (${n}-${p})!) = ${possibilidades}`;
        } else {
            formulaText = `Fórmula: CR(${n}, ${p}) = (${n}+${p}-1)! / (${p}! * (${n}-1)!) = ${possibilidades}`;
        }
        
        failReason.innerHTML = `
            <strong>${reason}</strong><br><br>
            <span style="color:#fbbf24; font-size: 13px;">
            📝 <strong>Análise do Sistema:</strong> Você estava tentando formar uma Combinação ${tipoCombo} 
            de ${n} cores tomadas ${p} a ${p}.<br><br>
            <span style="color:#a855f7; font-family: monospace;">${formulaText}</span><br><br>
            Você sabia que existem <strong>${possibilidades} combinações possíveis</strong> para esta missão?
            </span>
        `;
        
        showScreen('gameOverScreen');
    }
}

function setupNewMission() {
    inventory = [];
    currentMode = Math.random() > 0.5 ? "SIMPLES" : "REPETICAO";
    
    if (currentMode === "SIMPLES") {
        missionText.innerText = `Missão: Combinação Simples (Colete ${combinationSize} Diferentes)`;
        missionText.style.color = "#60a5fa";
    } else {
        missionText.innerText = `Missão: Combinação c/ Repetição (Colete ${combinationSize} Iguais ou Não)`;
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

function processCollectedBlock(colorCollected) {
    if (currentMode === "SIMPLES" && inventory.includes(colorCollected)) {
        endGame("Erro Matemático: Numa Combinação Simples, as CORES não podem repetir-se!");
        return;
    }

    inventory.push(colorCollected);
    updateHUD();

    if (inventory.length === combinationSize) {
        interactionsCompleted++;
        
        if (interactionsCompleted >= 2 && interactionsCompleted < 4) {
            combinationSize = 3;
        } else if (interactionsCompleted >= 4) {
            combinationSize = 4;
        }

        currentSpeed = Math.max(60, baseSpeed - (interactionsCompleted * 5));
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
            invDisplay += `<span style="color: ${inventory[i]}; text-shadow: 1px 1px 2px #000; font-size: 16px;">[■]</span> `;
        } else {
            invDisplay += `<span style="color: #ffffff;">[ ]</span> `;
        }
    }
    
    inventoryBox.innerHTML = invDisplay; 
}

function update() {
    if (!isPlaying) return;

    const head = { x: snake[0].x + velocity.x, y: snake[0].y + velocity.y };

    if (head.x < 0 || head.x >= cols || head.y < 0 || head.y >= rows) {
        spawnParticles(snake[0].x * gridSize + gridSize/2, snake[0].y * gridSize + gridSize/2, "#ef4444");
        endGame("Falha Crítica: Colisão estrutural (Parede).");
        return;
    }

    for (let part of snake) {
        if (head.x === part.x && head.y === part.y) {
            spawnParticles(head.x * gridSize + gridSize/2, head.y * gridSize + gridSize/2, "#ef4444");
            endGame("Falha Crítica: Corrompimento de dados (Bateu no próprio corpo).");
            return;
        }
    }

    snake.unshift(head);

    let ateBlock = false;
    for (let i = 0; i < blocksOnMap.length; i++) {
        if (head.x === blocksOnMap[i].x && head.y === blocksOnMap[i].y) {
            spawnParticles(head.x * gridSize + gridSize/2, head.y * gridSize + gridSize/2, blocksOnMap[i].color);
            processCollectedBlock(blocksOnMap[i].color);
            blocksOnMap.splice(i, 1);
            ateBlock = true;
            break;
        }
    }

    if (!ateBlock) {
        snake.pop(); 
    }
    
    particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.05;
    });
    particles = particles.filter(p => p.life > 0);

    draw();
}

function draw() {
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "rgba(51, 65, 85, 0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= canvas.width; x += gridSize) {
        ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height);
    }
    for (let y = 0; y <= canvas.height; y += gridSize) {
        ctx.moveTo(0, y); ctx.lineTo(canvas.width, y);
    }
    ctx.stroke();

    blocksOnMap.forEach(block => {
        ctx.shadowBlur = 15;
        ctx.shadowColor = block.color;
        ctx.fillStyle = block.color;
        ctx.fillRect(block.x * gridSize + 2, block.y * gridSize + 2, gridSize - 4, gridSize - 4);
    });

    snake.forEach((part, index) => {
        ctx.shadowBlur = index === 0 ? 15 : 10;
        ctx.shadowColor = index === 0 ? "#10b981" : "#059669";
        ctx.fillStyle = index === 0 ? "#10b981" : "#059669";
        ctx.fillRect(part.x * gridSize + 1, part.y * gridSize + 1, gridSize - 2, gridSize - 2);
    });
    
    ctx.shadowBlur = 0;

    particles.forEach(p => {
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 4, 4);
    });
    ctx.globalAlpha = 1.0;
}

const tituloPrincipal = document.querySelector('#startScreen h1');
if (tituloPrincipal) {
    tituloPrincipal.addEventListener('click', () => {
        if (isInfiniteMode) return;
        
        tapCount++;
        if (tapCount >= 5) {
            ativarModoInfinito();
            tapCount = 0;
        }
    });
}

function ativarModoInfinito() {
    isInfiniteMode = true;
    playSound('success'); 
    
    const titulo = document.querySelector('#startScreen h2');
    if (titulo) {
        titulo.innerText = "Operação: INFINITA (Desbloqueada!)";
        titulo.style.color = "#a855f7"; 
    }
    
    const texto = document.querySelector('#startScreen p');
    if (texto) {
        texto.innerHTML = "<strong>Modo Infinito:</strong> O limite de 5 pacotes foi desativado. Sobreviva até preencher todo o sistema e continue resolvendo as combinações. Boa sorte!";
    }
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