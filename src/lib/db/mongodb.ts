import { MongoClient, Db, Collection, Document } from "mongodb";
import { FeedSession, FeedSignal, StoredVideo, UserProfile } from "@/lib/feed/types";

const uri = process.env.MONGODB_URI?.trim();
const dbName = process.env.MONGODB_DB?.trim() || "rawmind";

let clientPromise: Promise<MongoClient> | null = null;
let indexesReadyPromise: Promise<void> | null = null;

async function ensureIndexes(db: Db) {
  if (!indexesReadyPromise) {
    indexesReadyPromise = Promise.all([
      db.collection<UserProfile>("profiles").createIndex({ deviceId: 1 }, { unique: true }),
      db.collection<FeedSession>("feed_sessions").createIndex({ sessionId: 1 }, { unique: true }),
      db.collection<FeedSession>("feed_sessions").createIndex({ deviceId: 1, promptSignature: 1, updatedAt: -1 }),
      db.collection<StoredVideo>("videos").createIndex({ sessionId: 1, videoId: 1 }, { unique: true }),
      db.collection<StoredVideo>("videos").createIndex({ sessionId: 1, served: 1 }),
      db.collection<FeedSignal>("signals").createIndex({ sessionId: 1, timestamp: -1 }),
      db.collection<FeedSignal>("signals").createIndex({ deviceId: 1, timestamp: -1 }),
    ]).then(() => undefined);
  }

  await indexesReadyPromise;
}

async function connectClient() {
  if (!uri) return null;

  if (!clientPromise) {
    clientPromise = new MongoClient(uri).connect();
  }

  return clientPromise;
}

export async function getMongoDb(): Promise<Db | null> {
  const client = await connectClient();
  if (!client) return null;

  const db = client.db(dbName);
  await ensureIndexes(db);
  return db;
}

export async function getCollection<T extends Document>(name: string): Promise<Collection<T> | null> {
  const db = await getMongoDb();
  return db ? db.collection<T>(name) : null;
}
