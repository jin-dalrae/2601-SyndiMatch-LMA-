require('dotenv').config();
const { MongoClient } = require('mongodb');

async function check() {
    const uri = process.env.MONGODB_URI;
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db('syndimatch');
        const p1 = await db.collection('participants').findOne({});
        console.log('Participant sample:', JSON.stringify(p1, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}
check();
