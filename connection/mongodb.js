import { MongoClient } from "mongodb";

const uri = process.env.DRIVERHUB_MONGODB_URI;

if (!uri) {
  throw new Error(
    "Please define DRIVERHUB_MONGODB_URI in your Vercel Environment Variables"
  );
}

const options = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 10000,
};

let client;
let clientPromise;

if (process.env.NODE_ENV === "development") {
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export async function getMongoClient() {
  return clientPromise;
}

export async function getDatabase() {
  const client = await getMongoClient();
  return client.db("opolot");
}

export default clientPromise;