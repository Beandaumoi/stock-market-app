"use server";

import { connectToDatabase } from "@/database/mongoose";

export const getAllUsersForEmail = async () => {
  try {
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) throw new Error("Database connection error");

    const users = await db
      .collection("user")
      .find(
        { email: { $exists: true, $ne: null } },
        { projection: { _id: 1, id: 1, email: 1, name: 1, country: 1 } }
      )
      .toArray();

    return users
      .filter((user) => user.name && user.email)
      .map((user) => ({
        id: user.id || user._id.toString() || "",
        name: user.name,
        email: user.email,
      }));
  } catch (error) {
    console.log("Error fetching users:", error);
    return [];
  }
};
