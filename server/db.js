// ========================================
// MongoDB Connection
// ========================================

const { MongoClient } = require('mongodb');

let db = null;
let client = null;

async function connectDB() {
    if (db) return db; // Reuse existing connection

    const uri = process.env.MONGODB_URI;
    if (!uri) {
        throw new Error('MONGODB_URI environment variable is not set');
    }

    try {
        // Use recommended options and timeout
        client = new MongoClient(uri, {
            serverSelectionTimeoutMS: 5000
        });

        await client.connect();
        db = client.db('syndimatch');

        console.log('✅ Connected to MongoDB Atlas');

        // Verify connection
        await db.command({ ping: 1 });
        console.log('📡 Database ping successful');

        return db;
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        throw error;
    }
}

function getDB() {
    if (!db) {
        throw new Error('Database not connected. Call connectDB() first.');
    }
    return db;
}

async function closeDB() {
    if (client) {
        await client.close();
        console.log('MongoDB connection closed');
    }
}

module.exports = { connectDB, getDB, closeDB };
