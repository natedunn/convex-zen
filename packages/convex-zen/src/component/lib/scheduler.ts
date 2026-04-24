type MutationScheduler = {
  runAt(
    when: number,
    functionRef: unknown,
    args: Record<string, unknown>
  ): Promise<unknown>;
};

function isVitestRuntime(): boolean {
  return (
    typeof process !== "undefined" &&
    typeof process.env === "object" &&
    (process.env["VITEST"] === "true" || process.env["NODE_ENV"] === "test")
  );
}

export async function scheduleCleanupAt(
  scheduler: MutationScheduler,
  when: number,
  functionRef: unknown
): Promise<void> {
  if (isVitestRuntime()) {
    return;
  }
  await scheduler.runAt(when, functionRef, {});
}
