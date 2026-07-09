
const mongoose = require('mongoose');
require('dotenv').config();
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const Provider = require('./models/Provider');
  const bLat = 22.71756064868018;
  const bLon = 75.87173837674439;
  const broadRadiusKm = 100;
  const broadRadiusRadians = broadRadiusKm / 6378.1;
  const candidateProviders = await Provider.find({
      status: 'verified',
      isOnline: true,
      providerCategory: 'sewak',
      location: {
          $geoWithin: {
              $centerSphere: [[bLon, bLat], broadRadiusRadians]
          }
      }
  }).lean();
  console.log('Candidates found via geoWithin:', candidateProviders.length);
  for(let p of candidateProviders) {
      console.log(' -', p.ownerName, p.location.coordinates);
  }
  process.exit(0);
});

