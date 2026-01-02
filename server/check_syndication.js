require('dotenv').config();
const { MongoClient } = require('mongodb');

async function check() {
    const uri = process.env.MONGODB_URI;
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db('syndimatch');
        const s1 = await db.collection('syndications').findOne({});
        const so1 = await db.collection('syndication_original').findOne({});
        console.log('Syndication sample:', s1);
        console.log('Syndication Original sample:', so1);
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}
check();
