const { MongoClient } = require('mongodb');

function createActivityStore({ mongoUri, mongoDbName }) {
  const trimmedUri = String(mongoUri || '').trim();
  const trimmedDbName = String(mongoDbName || 'learnfromus').trim();
  const mongoClient = trimmedUri ? new MongoClient(trimmedUri) : null;
  let activityCollection = null;
  let rateLimitCollection = null;

  async function connect() {
    if (!mongoClient) {
      return false;
    }

    await mongoClient.connect();
    const mongoDb = mongoClient.db(trimmedDbName);
    activityCollection = mongoDb.collection('activity_events');
    rateLimitCollection = mongoDb.collection('rate_limit_buckets');

    await activityCollection.createIndex({ userId: 1, createdAt: -1 });
    await activityCollection.createIndex({ type: 1, createdAt: -1 });
    await rateLimitCollection.createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 });
    await rateLimitCollection.createIndex({ key: 1 }, { unique: true });
    return true;
  }

  async function recordActivity(type, payload = {}) {
    if (!activityCollection) {
      return;
    }

    const { userId = null, ...rest } = payload;
    try {
      await activityCollection.insertOne({
        type,
        userId,
        createdAt: new Date(),
        ...rest
      });
    } catch (error) {
      console.error('Failed to record MongoDB activity event.', error);
    }
  }

  return {
    connect,
    isEnabled() {
      return Boolean(activityCollection);
    },
    getDbName() {
      return trimmedDbName;
    },
    getActivityCollection() {
      return activityCollection;
    },
    getRateLimitCollection() {
      return rateLimitCollection;
    },
    recordActivity
  };
}

module.exports = {
  createActivityStore
};
