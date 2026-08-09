import { FeedPage, UserProfile } from "@/lib/feed/types";

type ErrorPayload = { error?: string };
type SignalPayload = { ok: boolean; profile?: UserProfile };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

function isNumberRecord(value: unknown): value is Record<string, number> {
  return isRecord(value) && Object.values(value).every(isNumber);
}

function isUserProfile(value: unknown): value is UserProfile {
  if (!isRecord(value)) return false;
  return (
    isString(value.deviceId) &&
    isNumberRecord(value.topicAffinities) &&
    isNumberRecord(value.channelAffinities) &&
    isStringArray(value.seenVideoIds) &&
    isNumber(value.totalLikes) &&
    isNumber(value.totalSignals) &&
    isString(value.createdAt) &&
    isString(value.updatedAt)
  );
}

function isFeedPage(value: unknown): value is FeedPage {
  if (!isRecord(value)) return false;
  if (!isString(value.sessionId)) return false;
  if (!isRecord(value.intentProfile)) return false;
  if (!Array.isArray(value.videos)) return false;
  if (!isNumber(value.remainingCount)) return false;
  if (!isBoolean(value.hasMore)) return false;
  if (!isBoolean(value.refilling)) return false;
  if (value.profile !== undefined && !isUserProfile(value.profile)) return false;
  return true;
}

export async function parseErrorPayload(response: Response): Promise<ErrorPayload> {
  const data: unknown = await response.json();
  return isRecord(data) ? { error: isString(data.error) ? data.error : undefined } : {};
}

export async function parseFeedPagePayload(response: Response): Promise<FeedPage> {
  const data: unknown = await response.json();
  if (!isFeedPage(data)) {
    throw new Error("Invalid feed response from server");
  }
  return data;
}

export async function parseSignalPayload(response: Response): Promise<SignalPayload> {
  const data: unknown = await response.json();
  if (!isRecord(data) || !isBoolean(data.ok)) {
    throw new Error("Invalid signal response from server");
  }
  if (data.profile !== undefined && !isUserProfile(data.profile)) {
    throw new Error("Invalid signal profile from server");
  }
  return data as SignalPayload;
}
