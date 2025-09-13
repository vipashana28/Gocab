const { MongoClient } = require('mongodb');

async function revertCoordinates() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/gocab';
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db();
    const ridesCollection = db.collection('rides');
    
    // Find all rides with GeoJSON coordinate format
    const rides = await ridesCollection.find({
      "pickup.coordinates.type": "Point"
    }).toArray();
    
    console.log(`Found ${rides.length} rides with GeoJSON coordinate format`);
    
    for (const ride of rides) {
      const updateDoc = {};
      
      // Convert pickup coordinates back to lat/lng format
      if (ride.pickup && ride.pickup.coordinates && ride.pickup.coordinates.type === "Point") {
        updateDoc["pickup.coordinates"] = {
          latitude: ride.pickup.coordinates.coordinates[1],
          longitude: ride.pickup.coordinates.coordinates[0]
        };
      }
      
      // Convert destination coordinates back to lat/lng format
      if (ride.destination && ride.destination.coordinates && ride.destination.coordinates.type === "Point") {
        updateDoc["destination.coordinates"] = {
          latitude: ride.destination.coordinates.coordinates[1],
          longitude: ride.destination.coordinates.coordinates[0]
        };
      }
      
      if (Object.keys(updateDoc).length > 0) {
        await ridesCollection.updateOne(
          { _id: ride._id },
          { $set: updateDoc }
        );
        console.log(`Reverted ride ${ride._id}`);
      }
    }
    
    console.log('Coordinate reversion completed');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

revertCoordinates();
