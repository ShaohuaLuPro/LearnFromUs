function createHybridRateLimitStore() {
  const buckets = new Map();
  let mongoCollection = null;

  function prune(now) {
    for (const [key, bucket] of buckets.entries()) {
      if (bucket.resetAt <= now) {
        buckets.delete(key);
      }
    }
  }

  return {
    async configureMongoCollection(collection) {
      mongoCollection = collection || null;
    },
    async increment(key, windowMs) {
      const now = Date.now();
      const nextResetAt = now + windowMs;

      if (mongoCollection) {
        const existing = await mongoCollection.findOne({ key }, { projection: { count: 1, resetAt: 1 } });
        if (!existing || new Date(existing.resetAt).getTime() <= now) {
          await mongoCollection.updateOne(
            { key },
            {
              $set: {
                key,
                count: 1,
                resetAt: new Date(nextResetAt),
                expireAt: new Date(nextResetAt)
              }
            },
            { upsert: true }
          );
          return { count: 1, resetAt: nextResetAt };
        }

        const updated = await mongoCollection.findOneAndUpdate(
          { key },
          { $inc: { count: 1 } },
          { returnDocument: 'after', projection: { count: 1, resetAt: 1 } }
        );
        const nextBucket = updated?.value || updated;
        return {
          count: nextBucket?.count || existing.count + 1,
          resetAt: new Date(nextBucket?.resetAt || existing.resetAt).getTime()
        };
      }

      prune(now);
      const current = buckets.get(key);
      if (!current || current.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: nextResetAt });
        return { count: 1, resetAt: nextResetAt };
      }

      current.count += 1;
      return current;
    }
  };
}

function createRateLimitMiddleware(store, { windowMs, maxRequests, keyPrefix, keyResolver }) {
  return async (req, res, next) => {
    try {
      const identity = keyResolver ? keyResolver(req) : (req.ip || 'unknown');
      const key = `${keyPrefix}:${identity}`;
      const bucket = await store.increment(key, windowMs);
      if (bucket.count > maxRequests) {
        const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - Date.now()) / 1000));
        res.set('Retry-After', String(retryAfterSeconds));
        return res.status(429).json({ message: 'Too many requests. Please slow down and try again shortly.' });
      }
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = {
  createHybridRateLimitStore,
  createRateLimitMiddleware
};
