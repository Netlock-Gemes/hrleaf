import { MongoClient, Db } from 'mongodb';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGODB_DB || 'openleaf';

let db: Db;

export const connectToMongo = async (): Promise<Db> => {
  if (!db) {
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    db = client.db(DB_NAME);
    console.log('Connected to MongoDB');
  }
  return db;
};

// Constants (if needed to replace table names)
export const DOCUMENTS_COLLECTION_NAME = 'documents';
