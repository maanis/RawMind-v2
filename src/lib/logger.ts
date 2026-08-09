type LogLevel = "info" | "warn" | "error";

export function log(level: LogLevel, event: string, data?: Record<string, unknown>) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    event,
    ...data,
  };

  if (level === "error") {
    console.error(JSON.stringify(entry));
    return;
  }

  console.log(JSON.stringify(entry));
}
