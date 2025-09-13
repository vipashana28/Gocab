const { MongoClient } = require('mongodb');

async function fixCoordinates() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/gocab';
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db();
    const ridesCollection = db.collection('rides');
    
    // Find all rides with old coordinate format
    const rides = await ridesCollection.find({
      "pickup.coordinates.latitude": { $exists: true }
    }).toArray();
    
    console.log(`Found ${rides.length} rides with old coordinate format`);
    
    for (const ride of rides) {
      const updateDoc = {};
      
      // Convert pickup coordinates
      if (ride.pickup && ride.pickup.coordinates && ride.pickup.coordinates.latitude) {
        updateDoc["pickup.coordinates"] = {
          type: "Point",
          coordinates: [ride.pickup.coordinates.longitude, ride.pickup.coordinates.latitude]
        };
      }
      
      // Convert destination coordinates  
      if (ride.destination && ride.destination.coordinates && ride.destination.coordinates.latitude) {
        updateDoc["destination.coordinates"] = {
          type: "Point", 
          coordinates: [ride.destination.coordinates.longitude, ride.destination.coordinates.latitude]
        };
      }
      
      if (Object.keys(updateDoc).length > 0) {
        await ridesCollection.updateOne(
          { _id: ride._id },
          { $set: updateDoc }
        );
        console.log(`Updated ride ${ride._id}`);
      }
    }
    
    console.log('Coordinate conversion completed');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

fixCoordinates();
