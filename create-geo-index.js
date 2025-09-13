const { MongoClient } = require('mongodb');

async function createGeoIndex() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/gocab';
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db();
    const ridesCollection = db.collection('rides');
    
    // Create 2dsphere index on pickup coordinates
    const pickupIndexResult = await ridesCollection.createIndex(
      { "pickup.coordinates": "2dsphere" }
    );
    console.log('Pickup coordinates index created:', pickupIndexResult);
    
    // Create 2dsphere index on destination coordinates
    const destinationIndexResult = await ridesCollection.createIndex(
      { "destination.coordinates": "2dsphere" }
    );
    console.log('Destination coordinates index created:', destinationIndexResult);
    
    // List all indexes to verify
    const indexes = await ridesCollection.indexes();
    console.log('All indexes on rides collection:');
    indexes.forEach(index => {
      console.log('  -', JSON.stringify(index.key), index.name);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

createGeoIndex();
