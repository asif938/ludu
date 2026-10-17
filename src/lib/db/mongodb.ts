import mongoose from "mongoose";

/**
 * Lazy, cached MongoDB connection.
 *
 * Persistence is a resilience *enhancement*, not a hard requirement for the
 * app to boot: if MONGODB_URI is unset (e.g. local dev without Atlas yet),
 * room state still works via the in-memory runtime store, it just will not
 * survive a server restart. See README for the documented limitation.
 */

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var __ludoMongooseCache: MongooseCache | undefined;
}

const cache: MongooseCache = globalThis.__ludoMongooseCache ?? {
  conn: null,
  promise: null,
};
globalThis.__ludoMongooseCache = cache;

let warnedMissingUri = false;

export function isPersistenceConfigured(): boolean {
  return Boolean(process.env.MONGODB_URI);
}

export async function connectToDatabase(): Promise<typeof mongoose | null> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    if (!warnedMissingUri) {
      console.warn(
        "[db] MONGODB_URI is not set. Running without persistence: " +
          "rooms and games exist only in memory and will NOT survive a " +
          "server restart. Set MONGODB_URI (see .env.example) to enable " +
          "MongoDB Atlas persistence and crash recovery.",
      );
      warnedMissingUri = true;
    }
    return null;
  }

  if (cache.conn) return cache.conn;

  if (!cache.promise) {
    cache.promise = mongoose.connect(uri, {
      maxPoolSize: 10,
    });
  }

  cache.conn = await cache.promise;
  return cache.conn;
}
