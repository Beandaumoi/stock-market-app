#!/usr/bin/env node

/**
 * Debug Script for getAllUsersForEmail function
 * This script will help identify why the function returns "No users found"
 */

import { fileURLToPath } from "url";
import { dirname, join } from "path";
import dotenv from "dotenv";
import mongoose from "mongoose";

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, ".env") });

const MONGODB_URI = process.env.MONGODB_URI;

const connectToDatabase = async () => {
  if (!MONGODB_URI) {
    throw new Error("Please define the MONGODB_URI environment variable");
  }

  try {
    await mongoose.connect(MONGODB_URI, { bufferCommands: false });
    console.log("✅ Connected to database successfully");
    return mongoose;
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    throw error;
  }
};

async function debugGetAllUsersForEmail() {
  console.log("🔍 Debugging getAllUsersForEmail function...\n");

  try {
    const mongooseInstance = await connectToDatabase();
    const db = mongooseInstance.connection.db;

    if (!db) {
      console.error("❌ Database connection error");
      return;
    }

    console.log("📊 Step 1: Checking total users in collection...");
    const totalUsers = await db.collection("user").countDocuments(); // Đổi thành "user"
    console.log(`📈 Total users in collection: ${totalUsers}`);

    if (totalUsers === 0) {
      console.log(
        "⚠️  No users found in the collection. The collection might be empty or named differently."
      );

      // Check all collections
      console.log("\n📋 Available collections:");
      const collections = await db.listCollections().toArray();
      collections.forEach((col) => console.log(`  - ${col.name}`));
      return;
    }

    console.log("\n📊 Step 2: Checking users with email field...");
    const usersWithEmail = await db.collection("user").countDocuments({
      email: { $exists: true, $ne: null },
    });
    console.log(`📧 Users with email field: ${usersWithEmail}`);

    console.log("\n📊 Step 3: Sample user documents...");
    const sampleUsers = await db.collection("user").find({}).limit(3).toArray();
    console.log("👤 Sample users structure:");
    sampleUsers.forEach((user, index) => {
      console.log(`\nUser ${index + 1}:`);
      console.log(`  _id: ${user._id}`);
      console.log(`  id: ${user.id || "undefined"}`);
      console.log(`  name: ${user.name || "undefined"}`);
      console.log(`  email: ${user.email || "undefined"}`);
      console.log(`  country: ${user.country || "undefined"}`);
    });

    console.log(
      "\n📊 Step 4: Running the exact query from getAllUsersForEmail..."
    );
    const queryResult = await db
      .collection("user")
      .find(
        { email: { $exists: true, $ne: null } },
        { projection: { _id: 1, id: 1, email: 1, name: 1, country: 1 } }
      )
      .toArray();

    console.log(`🔍 Query result count: ${queryResult.length}`);
    console.log("📋 Query results:");
    queryResult.forEach((user, index) => {
      console.log(`\nResult ${index + 1}:`);
      console.log(`  _id: ${user._id}`);
      console.log(`  id: ${user.id || "undefined"}`);
      console.log(`  name: ${user.name || "undefined"}`);
      console.log(`  email: ${user.email || "undefined"}`);
      console.log(`  country: ${user.country || "undefined"}`);
    });

    console.log("\n📊 Step 5: Applying filter logic...");
    const filteredUsers = queryResult.filter((user) => user.name && user.email);
    console.log(
      `✅ Users after filter (name && email): ${filteredUsers.length}`
    );

    if (filteredUsers.length === 0) {
      console.log("\n❌ PROBLEM FOUND: All users are being filtered out!");
      console.log("🔍 Checking what's causing the filter to fail...");

      queryResult.forEach((user, index) => {
        console.log(`\nUser ${index + 1} filter check:`);
        console.log(
          `  name: "${user.name}" (${typeof user.name}) - ${
            user.name ? "✅" : "❌"
          }`
        );
        console.log(
          `  email: "${user.email}" (${typeof user.email}) - ${
            user.email ? "✅" : "❌"
          }`
        );
        console.log(
          `  passes filter: ${user.name && user.email ? "✅" : "❌"}`
        );
      });
    }

    console.log("\n📊 Step 6: Final mapped result...");
    const finalResult = filteredUsers.map((user) => ({
      id: user.id || user._id.toString() || "",
      name: user.name,
      email: user.email,
    }));

    console.log(`📤 Final result count: ${finalResult.length}`);
    console.log("📋 Final mapped users:");
    finalResult.forEach((user, index) => {
      console.log(`\nFinal User ${index + 1}:`);
      console.log(`  id: "${user.id}"`);
      console.log(`  name: "${user.name}"`);
      console.log(`  email: "${user.email}"`);
    });

    if (finalResult.length === 0) {
      console.log(
        "\n🚨 CONCLUSION: The function returns an empty array because:"
      );
      console.log("   - Users exist in database");
      console.log(
        "   - But they don't pass the filter (user.name && user.email)"
      );
      console.log(
        "   - Check if your users have both 'name' and 'email' fields properly set"
      );
    } else {
      console.log(
        "\n✅ CONCLUSION: The function should work correctly and return users"
      );
    }
  } catch (error) {
    console.error("\n❌ Error during debug:", error);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log("\n🔒 Database connection closed");
    }
  }
}

// Handle unhandled rejections
process.on("unhandledRejection", (error) => {
  console.error("\n❌ Unhandled rejection:", error);
  process.exit(1);
});

// Run the debug
debugGetAllUsersForEmail();
