export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureMapAnythingService } = await import("./lib/mapAnythingServer");
    void ensureMapAnythingService().catch((error) => {
      console.warn(`[map-anything] app-managed startup unavailable: ${error instanceof Error ? error.message : error}`);
    });
    const { startReconstructionWorker } = await import("./lib/queue");
    await startReconstructionWorker();
  }
}
