import { Queue, Worker, type Job } from "bullmq";
import { redisConnection, isRedisReachable } from "./redis";
import { reconstructScan } from "./reconstruct";

const QUEUE_NAME = "scan-reconstruction";

let reconstructionQueue: Queue<{ scanId: string }> | null = null;
let workerStarted = false;

/** Starts the BullMQ worker once per process (called from instrumentation.ts).
 * Probes Valkey first — if the container isn't up yet, this fails once and
 * we skip BullMQ entirely instead of letting it retry forever. */
export async function startReconstructionWorker() {
  if (workerStarted) return;
  workerStarted = true;

  if (!(await isRedisReachable())) {
    console.warn(
      "[queue] Valkey unreachable (run `docker compose up -d valkey`) — reconstruction will run in-process instead of via BullMQ."
    );
    return;
  }

  reconstructionQueue = new Queue(QUEUE_NAME, { connection: redisConnection });

  const worker = new Worker(
    QUEUE_NAME,
    async (job: Job<{ scanId: string }>) => {
      await reconstructScan(job.data.scanId);
    },
    { connection: redisConnection }
  );

  worker.on("error", (err) => {
    console.warn("[queue] Valkey worker error:", err.message);
  });
}

/** Enqueues reconstruction via BullMQ/Valkey when available; otherwise runs
 * the job inline so the demo flow still completes. */
export async function enqueueScanReconstruction(scanId: string) {
  if (reconstructionQueue) {
    try {
      await reconstructionQueue.add(
        "reconstruct",
        { scanId },
        { removeOnComplete: true, removeOnFail: true }
      );
      return;
    } catch (err) {
      console.warn(
        "[queue] Falling back to in-process reconstruction (Redis unreachable):",
        err instanceof Error ? err.message : err
      );
    }
  }
  void reconstructScan(scanId);
}
