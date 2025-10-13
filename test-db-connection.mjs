#!/usr/bin/env node

/**
 * Database Connection Test Script
 * 
 * This script tests the MongoDB connection using your existing mongoose configuration.
 * It will attempt to connect to the database and provide detailed feedback.
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

// Import the connection function inline since we can't import TS directly
const MONGODB_URI = process.env.MONGODB_URI;

let cached = global.mongooseCache;

if (!cached) {
  cached = global.mongooseCache = { conn: null, promise: null };
}

const connectToDatabase = async () => {
  if (!MONGODB_URI) {
    throw new Error(
      "Please define the MONGODB_URI environment variable inside .env"
    );
  }

  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, { bufferCommands: false });
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    cached.promise = null;
    throw error;
  }

  console.log(`Connected to database ${MONGODB_URI}`);
  return cached.conn;
};

async function testDatabaseConnection() {
  console.log('🔍 Testing Database Connection...\n');
  
  try {
    // Test 1: Check if MONGODB_URI is set
    console.log('✅ Step 1: Checking environment variables...');
    const mongoUri = process.env.MONGODB_URI;
    
    if (!mongoUri) {
      console.error('❌ MONGODB_URI environment variable is not set');
      console.log('💡 Please create a .env.local file with your MongoDB connection string\n');
      process.exit(1);
    }
    
    console.log('✅ MONGODB_URI is set');
    console.log(`🔗 Connection string format: ${mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}\n`);
    
    // Test 2: Attempt to connect
    console.log('✅ Step 2: Attempting to connect to database...');
    const startTime = Date.now();
    
    await connectToDatabase();
    
    const connectionTime = Date.now() - startTime;
    console.log(`✅ Successfully connected to database in ${connectionTime}ms`);
    
    // Test 3: Check connection state
    console.log('✅ Step 3: Verifying connection state...');
    const connectionState = mongoose.connection.readyState;
    const states = {
      0: 'disconnected',
      1: 'connected', 
      2: 'connecting',
      3: 'disconnecting'
    };
    
    console.log(`🔄 Connection state: ${states[connectionState]} (${connectionState})`);
    
    if (connectionState === 1) {
      console.log('✅ Database connection is active and healthy');
      
      // Test 4: Basic database operation
      console.log('✅ Step 4: Testing basic database operations...');
      const dbName = mongoose.connection.db?.databaseName;
      console.log(`📊 Connected to database: ${dbName}`);
      
      // List collections (basic operation test)
      const collections = await mongoose.connection.db?.listCollections().toArray();
      console.log(`📁 Available collections: ${collections?.length || 0}`);
      
      if (collections && collections.length > 0) {
        console.log('📋 Collection names:', collections.map(c => c.name).join(', '));
      }
      
    } else {
      console.log('⚠️  Database connection is not in connected state');
    }
    
  } catch (error) {
    console.error('\n❌ Database connection failed:');
    console.error('Error:', error.message);
    
    if (error.message.includes('ENOTFOUND')) {
      console.log('\n💡 This appears to be a DNS resolution error. Please check:');
      console.log('   - Your internet connection');
      console.log('   - The MongoDB server hostname in your connection string');
    } else if (error.message.includes('authentication failed')) {
      console.log('\n💡 Authentication failed. Please check:');
      console.log('   - Your username and password in the connection string');
      console.log('   - Database user permissions');
    } else if (error.message.includes('timeout')) {
      console.log('\n💡 Connection timeout. Please check:');
      console.log('   - Your network connection');
      console.log('   - MongoDB server availability');
      console.log('   - Firewall settings');
    }
    
    process.exit(1);
  } finally {
    // Clean up connection
    if (mongoose.connection.readyState === 1) {
      console.log('\n🔒 Closing database connection...');
      await mongoose.connection.close();
      console.log('✅ Connection closed successfully');
    }
  }
  
  console.log('\n🎉 Database connection test completed successfully!');
}

// Handle unhandled rejections
process.on('unhandledRejection', (error) => {
  console.error('\n❌ Unhandled rejection:', error);
  process.exit(1);
});

// Run the test
testDatabaseConnection();