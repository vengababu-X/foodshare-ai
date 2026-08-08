import mongoose from 'mongoose';

const RAW_MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/food-share-ai';

/**
 * Explicit dedicated database name. The app must NEVER write to MongoDB's
 * sample databases (sample_mflix, sample_restaurants, ...) or the default
 * `test` database — every document goes to this database's collections.
 * Override with MONGODB_DB if you need a different name.
 */
export const DB_NAME = process.env.MONGODB_DB || 'foodshare_db';

/** Known sample/default database names that must never be written to. */
const SAMPLE_DB_NAMES = new Set([
  'sample_mflix',
  'sample_airbnb',
  'sample_restaurants',
  'sample_supplies',
  'sample_training',
  'sample_analytics',
  'test',
  'admin',
  'local',
]);

/**
 * Guarantee the connection URI targets a dedicated database:
 *  - No database in the URI            → append DB_NAME (default foodshare_db)
 *  - A known sample/default database   → replace it with DB_NAME
 *  - Any other explicit database name  → kept as-is (respects the setup)
 */
function resolveMongoUri(raw: string): string {
  try {
    const url = new URL(raw);
    const dbName = url.pathname.replace(/^\//, '').split('?')[0];
    if (!dbName || SAMPLE_DB_NAMES.has(dbName.toLowerCase())) {
      url.pathname = `/${DB_NAME}`;
      return url.toString();
    }
    return raw;
  } catch {
    // Not a parseable URL — connect with the raw string as-is.
    return raw;
  }
}

const MONGODB_URI = resolveMongoUri(RAW_MONGODB_URI);

export const ACTIVE_DB_NAME = (() => {
  try {
    return new URL(MONGODB_URI).pathname.replace(/^\//, '').split('?')[0] || DB_NAME;
  } catch {
    return DB_NAME;
  }
})();

/** True when the thrown error is a MongoDB connection/selection/timeout failure. */
export function isDbConnectionError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const name = (error as { name?: string }).name || '';
  return (
    name === 'MongoServerSelectionError' ||
    name === 'MongooseServerSelectionError' ||
    name === 'MongoNetworkError' ||
    name === 'MongoNetworkTimeoutError' ||
    name === 'MongoTimeoutError' ||
    name === 'MongoParseError'
  );
}

// ── Smart Hybrid probe ────────────────────────────────────────────────────

let mongoDownAt: number | null = null;
const MONGO_RETRY_MS = 30_000; // don't re-probe for 30s after a failure

/**
 * True when MongoDB is reachable. After a connection failure the probe is
 * short-circuited for 30 seconds so the local JSON fallback kicks in without
 * every request waiting the full 5s server-selection timeout.
 */
export async function canUseMongo(): Promise<boolean> {
  if (mongoDownAt && Date.now() - mongoDownAt < MONGO_RETRY_MS) {
    return false;
  }
  try {
    await connectDB();
    mongoDownAt = null;
    return true;
  } catch (error) {
    console.warn('[hybrid] MongoDB unreachable — local JSON store fallback active.', error);
    mongoDownAt = Date.now();
    return false;
  }
}


interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

// Extend global with mongoose cache
declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

// Prevent multiple connections during hot-reloading
const cached: MongooseCache = global.mongooseCache || { conn: null, promise: null };

if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

/**
 * Connect to MongoDB using a cached Mongoose connection so Next.js serverless
 * route invocations reuse the same pool instead of exhausting connections.
 *
 * Every API route must call this before touching the models — there is no
 * offline/demo fallback: if MongoDB is unreachable the caller surfaces an error.
 */
export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    console.log(`Connecting to MongoDB (database: ${ACTIVE_DB_NAME})...`);
    cached.promise = mongoose
      .connect(MONGODB_URI, opts)
      .then((mongoose) => {
        console.log('MongoDB connected successfully');
        return mongoose;
      })
      .catch((error) => {
        console.error('MongoDB connection error:', error);
        cached.promise = null;
        throw error;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    cached.promise = null;
    throw error;
  }

  return cached.conn;
}

export async function disconnectDB(): Promise<void> {
  if (cached.conn) {
    await cached.conn.disconnect();
    cached.conn = null;
    cached.promise = null;
    console.log('MongoDB disconnected');
  }
}

// Event listeners for connection state
mongoose.connection.on('connected', () => {
  console.log('Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err: Error) => {
  console.error('Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('Mongoose disconnected');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await disconnectDB();
  process.exit(0);
});

export default connectDB;
