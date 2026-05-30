// Next.js calls this once per server boot. We use it to start the
// background task worker so queued goal-mode tasks run autonomously
// without needing an external cron or process.

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startTaskWorker } = await import("./lib/task-worker");
    startTaskWorker();
  }
}
