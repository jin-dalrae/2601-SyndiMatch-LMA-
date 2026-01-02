require('dotenv').config();
const { MongoClient } = require('mongodb');

async function check() {
    const uri = process.env.MONGODB_URI;
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db('syndimatch');
        const p1 = await db.collection('participants').findOne({});
        const pa1 = await db.collection('participant_agents').findOne({});
        console.log('Sample from participants:', p1);
        console.log('Sample from participant_agents:', pa1);
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}
check();
