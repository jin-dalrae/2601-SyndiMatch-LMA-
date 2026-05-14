require('dotenv').config();
const { MongoClient } = require('mongodb');

async function check() {
    const uri = process.env.MONGODB_URI;
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db('syndimatch');
        const collections = await db.listCollections().toArray();
        console.log('Collections:', collections.map(c => c.name));
        for (const col of collections) {
            const count = await db.collection(col.name).countDocuments();
            console.log(`${col.name}: ${count}`);
        }
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}
check();
