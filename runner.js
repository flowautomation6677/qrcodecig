const { spawn } = require('child_process');

console.log('====================================================');
console.log('[Runner] Iniciando serviços do Disparador WhatsApp...');
console.log('====================================================');

let workerProcess = null;
let isShuttingDown = false;

function startWorker() {
  if (isShuttingDown) return;
  console.log('[Runner] Iniciando Worker BullMQ de Disparos...');

  // Usa npx tsx para executar o worker TypeScript diretamente
  workerProcess = spawn('npx', ['tsx', 'src/lib/worker.ts'], {
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });

  workerProcess.on('exit', (code, signal) => {
    if (isShuttingDown) return;
    console.warn(`[Runner] Worker encerrou (código: ${code}, sinal: ${signal}). Reiniciando em 3s...`);
    setTimeout(startWorker, 3000);
  });
}

// 1. Inicia o Worker de campanhas
startWorker();

// 2. Inicia o Next.js na porta 3000
console.log('[Runner] Iniciando servidor Next.js na porta 3000...');
const nextProcess = spawn('npx', ['next', 'start', '-H', '0.0.0.0', '-p', '3000'], {
  stdio: 'inherit',
  shell: true,
  env: process.env,
});

nextProcess.on('exit', (code) => {
  console.log(`[Runner] Next.js encerrou com código ${code}.`);
  isShuttingDown = true;
  if (workerProcess) {
    try {
      workerProcess.kill();
    } catch (_) {}
  }
  process.exit(code || 0);
});

// Encerramento gracioso para sinais Docker (SIGTERM / SIGINT)
const handleShutdown = (signal) => {
  console.log(`[Runner] Recebido sinal ${signal}, encerrando todos os serviços...`);
  isShuttingDown = true;
  if (workerProcess) {
    try {
      workerProcess.kill(signal);
    } catch (_) {}
  }
  if (nextProcess) {
    try {
      nextProcess.kill(signal);
    } catch (_) {}
  }
  setTimeout(() => process.exit(0), 1000);
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
