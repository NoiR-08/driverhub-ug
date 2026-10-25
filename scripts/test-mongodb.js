
import { getDatabase } from "../connection/mongodb.js";

try {
  const db = await getDatabase();
  await db.command({ ping: 1 });

  console.log("SUCCESS: Connected to MongoDB Atlas.");
  console.log("Database:", db.databaseName);
} catch (error) {
  console.error("MongoDB connection failed:", error.message);
  process.exitCode = 1;
}
