export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startReconstructionWorker } = await import("./lib/queue");
    await startReconstructionWorker();
  }
}
