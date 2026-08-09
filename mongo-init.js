// Runs once on first container start; creates DB, user, collections, and indexes.
const appDb = process.env.MONGO_APP_DB || "mindscroll";
const appUser = process.env.MONGO_APP_USERNAME || "mindscroll_app";
const appPassword = process.env.MONGO_APP_PASSWORD;

if (!appPassword) {
  throw new Error("MONGO_APP_PASSWORD is required for mongo-init.js");
}

db = db.getSiblingDB(appDb);

db.createUser({
  user: appUser,
  pwd: appPassword,
  roles: [{ role: "readWrite", db: appDb }],
});

db.createCollection('profiles');
db.createCollection('feed_sessions');
db.createCollection('videos');
db.createCollection('signals');

db.profiles.createIndex({ deviceId: 1 }, { unique: true });

db.feed_sessions.createIndex({ sessionId: 1 }, { unique: true });
db.feed_sessions.createIndex({ deviceId: 1, promptSignature: 1, updatedAt: -1 });

db.videos.createIndex({ sessionId: 1, videoId: 1 }, { unique: true });
db.videos.createIndex({ sessionId: 1, served: 1 });
db.videos.createIndex({ topicTags: 1, baseScore: -1 });
db.videos.createIndex({ createdAt: 1 });

db.signals.createIndex({ sessionId: 1, timestamp: -1 });
db.signals.createIndex({ deviceId: 1, timestamp: -1 });

print("MindScroll database initialized successfully");
