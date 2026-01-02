require('dotenv').config();
const { MongoClient } = require('mongodb');

async function check() {
    const uri = process.env.MONGODB_URI;
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db('syndimatch');
        const o1 = await db.collection('originator').findOne({});
        const oa1 = await db.collection('originator_agents').findOne({});
        console.log('Originator sample:', o1);
        console.log('Originator Agent sample:', oa1);
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}
check();
