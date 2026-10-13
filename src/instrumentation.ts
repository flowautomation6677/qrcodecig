export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[Instrumentation] Inicializando Worker de Disparos BullMQ...');
    await import('./lib/worker');
  }
}
