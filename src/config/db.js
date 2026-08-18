const mongoose = require('mongoose');

// In serverless environments (Vercel), each function invocation can reuse
// a "warm" instance. Without caching, every request would try to open a
// brand-new MongoDB connection, which is slow and can time out under load.
// This caches the connection promise across invocations of the same
// warm instance.
let cachedConnectionPromise = null;

async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    // Already connected on this warm instance.
    return mongoose.connection;
  }

  if (cachedConnectionPromise) {
    return cachedConnectionPromise;
  }

  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/veritas';

  cachedConnectionPromise = mongoose
    .connect(uri, {
      serverSelectionTimeoutMS: 8000, // fail fast instead of hanging the function
    })
    .then((conn) => {
      const maskedUri = uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');
      console.log(`[db] MongoDB connected -> ${maskedUri}`);
      return conn;
    })
    .catch((err) => {
      cachedConnectionPromise = null; // allow retry on next request
      console.error('[db] MongoDB connection failed:', err.message);
      throw err;
    });

  return cachedConnectionPromise;
}

module.exports = connectDB;