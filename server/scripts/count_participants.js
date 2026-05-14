require('dotenv').config();
const { MongoClient } = require('mongodb');

async function check() {
    const uri = process.env.MONGODB_URI;
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db('syndimatch');
        const count = await db.collection('participant_agents').countDocuments();
        console.log(`Participants count: ${count}`);
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}
check();
