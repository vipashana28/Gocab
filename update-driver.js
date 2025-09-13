

const { MongoClient, ObjectId } = require('mongodb');

async function updateDriver() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/gocab';
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db();
    const driversCollection = db.collection('drivers');
    
    // Update the driver to be online and available
    const result = await driversCollection.updateOne(
      { _id: new ObjectId('68c546ff032b0838631e3912') },
      {
        $set: {
          isOnline: true,
          isAvailable: true,
          status: 'active',
          backgroundCheckStatus: 'approved',
          'currentLocation.coordinates': {
            latitude: 13.12,
            longitude: 77.63
          },
          'currentLocation.address': 'Bangalore, Karnataka',
          'currentLocation.lastUpdated': new Date()
        }
      }
    );
    
    console.log('Driver updated:', result);
    
    // Verify the update
    const driver = await driversCollection.findOne({ _id: new ObjectId('68c546ff032b0838631e3912') });
    console.log('Updated driver:', JSON.stringify(driver, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

updateDriver();
