const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '../.env.local' });

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://elitestar764_db_user:sJ4SSg85g3oBtpzJ@cluster0.lr4enwq.mongodb.net/?appName=Cluster0';

// Define schemas (simplified versions for seed script)
const UserSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  role: { type: String, enum: ['DONOR', 'NGO', 'VOLUNTEER', 'ADMIN'] },
  donorType: { type: String, enum: ['Restaurant', 'Hotel', 'Hostel', 'Event', 'Individual'] },
  phone: String,
  location: {
    type: { type: String, default: 'Point' },
    coordinates: [Number],
  },
  isVerified: { type: Boolean, default: false },
  capacity: { type: Number, default: 0 },
  rating: { type: Number, default: 5.0 },
  totalDonations: { type: Number, default: 0 },
}, { timestamps: true });

const DonationSchema = new mongoose.Schema({
  donorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  donorType: String,
  items: [{
    name: String,
    qty: Number,
    unit: String,
  }],
  cookedAt: Date,
  expiresAt: Date,
  urgencyScore: { type: Number, default: 0 },
  aiQualityScore: { type: Number, default: 85 },
  aiFreshnessStatus: { type: String, default: 'APPROVED' },
  status: { type: String, enum: ['AVAILABLE', 'ACCEPTED', 'PICKED_UP', 'DELIVERED', 'EXPIRED', 'PENDING', 'MATCHED'], default: 'AVAILABLE' },
  location: {
    type: { type: String, default: 'Point' },
    coordinates: [Number],
  },
  image: String, // Canonical Cloudinary image URL
  photoUrl: String,
  notes: String,
  pickupQrCode: String,
  deliveryQrCode: String,
  matchedNGO: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedVolunteer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  mealsProvided: { type: Number, default: 0 },
  carbonSavedKg: { type: Number, default: 0 },
}, { timestamps: true });

const DeliverySchema = new mongoose.Schema({
  donationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Donation' },
  assignedNGO: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  volunteerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  routeInfo: {
    distance: Number,
    duration: Number,
    steps: [],
  },
  routeCoordinates: [[Number]], // [lat, lng] pairs for the Leaflet polyline
  status: {
    type: String,
    enum: ['ASSIGNED', 'PICKUP_VERIFIED', 'IN_TRANSIT', 'DELIVERY_VERIFIED', 'COMPLETED', 'CANCELLED'],
    default: 'ASSIGNED',
  },
  pickupLocation: { type: { type: String, default: 'Point' }, coordinates: [Number] },
  dropoffLocation: { type: { type: String, default: 'Point' }, coordinates: [Number] },
  carbonSavedKg: { type: Number, default: 0 },
  mealsProvided: { type: Number, default: 0 },
}, { timestamps: true });

// Register models so the script can create documents (collections match the
// app's Mongoose models: users / donations / deliveries)
const User = mongoose.model('User', UserSchema);
const Donation = mongoose.model('Donation', DonationSchema);
const Delivery = mongoose.model('Delivery', DeliverySchema);

// City: Hyderabad, India coordinates (real coordinates)
const HYDERABAD_LOCATIONS = [
  { name: 'MG Road, Hyderabad', lat: 17.3850, lng: 78.4867 },
  { name: 'Banjara Hills', lat: 17.4156, lng: 78.4347 },
  { name: 'Jubilee Hills', lat: 17.4239, lng: 78.4488 },
  { name: 'Ameerpet', lat: 17.4399, lng: 78.4487 },
  { name: 'Madhapur', lat: 17.4486, lng: 78.3908 },
  { name: 'Gachibowli', lat: 17.4401, lng: 78.3489 },
  { name: 'Kondapur', lat: 17.4646, lng: 78.3428 },
  { name: 'HITEC City', lat: 17.4435, lng: 78.3772 },
];

// Test users data with real Hyderabad coordinates
const users = [
  // Donors (Restaurants)
  {
    name: 'Spice Garden Restaurant',
    email: 'restaurant1@example.com',
    password: 'password123',
    role: 'DONOR',
    donorType: 'Restaurant',
    phone: '+91-9876543210',
    location: { type: 'Point', coordinates: [78.4867, 17.3850] }, // MG Road
    isVerified: true,
    capacity: 0,
    rating: 4.8,
    totalDonations: 25,
  },
  {
    name: 'Taste of India',
    email: 'restaurant2@example.com',
    password: 'password123',
    role: 'DONOR',
    donorType: 'Restaurant',
    phone: '+91-9876543211',
    location: { type: 'Point', coordinates: [78.4347, 17.4156] }, // Banjara Hills
    isVerified: true,
    capacity: 0,
    rating: 4.9,
    totalDonations: 42,
  },
  // Donors (Hotels)
  {
    name: 'Grand Hyatt Hyderabad',
    email: 'hotel1@example.com',
    password: 'password123',
    role: 'DONOR',
    donorType: 'Hotel',
    phone: '+91-9876543218',
    location: { type: 'Point', coordinates: [78.4488, 17.4239] }, // Jubilee Hills
    isVerified: true,
    capacity: 0,
    rating: 4.7,
    totalDonations: 18,
  },
  {
    name: 'Taj Falaknuma Palace',
    email: 'hotel2@example.com',
    password: 'password123',
    role: 'DONOR',
    donorType: 'Hotel',
    phone: '+91-9876543219',
    location: { type: 'Point', coordinates: [78.4487, 17.4399] }, // Ameerpet
    isVerified: true,
    capacity: 0,
    rating: 4.9,
    totalDonations: 35,
  },
  // Donors (Hostels)
  {
    name: 'Zostel Hyderabad',
    email: 'hostel1@example.com',
    password: 'password123',
    role: 'DONOR',
    donorType: 'Hostel',
    phone: '+91-9876543220',
    location: { type: 'Point', coordinates: [78.3908, 17.4486] }, // Madhapur
    isVerified: true,
    capacity: 0,
    rating: 4.5,
    totalDonations: 12,
  },
  // NGOs
  {
    name: 'Food For All Foundation',
    email: 'ngo1@example.com',
    password: 'password123',
    role: 'NGO',
    phone: '+91-9876543212',
    location: { type: 'Point', coordinates: [78.4488, 17.4239] }, // Jubilee Hills
    isVerified: true,
    capacity: 500,
  },
  {
    name: 'Hunger Relief Society',
    email: 'ngo2@example.com',
    password: 'password123',
    role: 'NGO',
    phone: '+91-9876543213',
    location: { type: 'Point', coordinates: [78.4487, 17.4399] }, // Ameerpet
    isVerified: true,
    capacity: 300,
  },
  {
    name: 'Community Kitchen Trust',
    email: 'ngo3@example.com',
    password: 'password123',
    role: 'NGO',
    phone: '+91-9876543214',
    location: { type: 'Point', coordinates: [78.3908, 17.4486] }, // Madhapur
    isVerified: false, // Pending verification
    capacity: 200,
  },
  // Volunteers
  {
    name: 'Rahul Kumar',
    email: 'volunteer1@example.com',
    password: 'password123',
    role: 'VOLUNTEER',
    phone: '+91-9876543215',
    location: { type: 'Point', coordinates: [78.3489, 17.4401] }, // Gachibowli
    isVerified: true,
    capacity: 0,
  },
  {
    name: 'Priya Sharma',
    email: 'volunteer2@example.com',
    password: 'password123',
    role: 'VOLUNTEER',
    phone: '+91-9876543216',
    location: { type: 'Point', coordinates: [78.3428, 17.4646] }, // Kondapur
    isVerified: true,
    capacity: 0,
  },
  // Admin
  {
    name: 'Admin User',
    email: 'admin@example.com',
    password: 'password123',
    role: 'ADMIN',
    phone: '+91-9876543217',
    location: { type: 'Point', coordinates: [78.3772, 17.4435] }, // HITEC City
    isVerified: true,
    capacity: 0,
  },
  // ── Convenience accounts (real MongoDB users) ────────────────────────────
  {
    name: 'FoodShare Admin',
    email: 'admin@foodshare.ai',
    password: 'password123',
    role: 'ADMIN',
    phone: '+91-9876543200',
    location: { type: 'Point', coordinates: [78.4867, 17.3850] }, // MG Road
    isVerified: true,
    capacity: 0,
  },
  {
    name: 'Spice Garden Restaurant',
    email: 'donor@restaurant.com',
    password: 'password123',
    role: 'DONOR',
    donorType: 'Restaurant',
    phone: '+91-9876543201',
    location: { type: 'Point', coordinates: [78.4867, 17.3850] }, // MG Road
    isVerified: true,
    capacity: 0,
    rating: 4.8,
    totalDonations: 25,
  },
  {
    name: 'Hunger Relief Society',
    email: 'ngo@hungerrelief.org',
    password: 'password123',
    role: 'NGO',
    phone: '+91-9876543202',
    location: { type: 'Point', coordinates: [78.4487, 17.4399] }, // Ameerpet
    isVerified: true,
    capacity: 300,
  },
  {
    name: 'Demo Volunteer',
    email: 'volunteer@foodshare.ai',
    password: 'password123',
    role: 'VOLUNTEER',
    phone: '+91-9876543203',
    location: { type: 'Point', coordinates: [78.3489, 17.4401] }, // Gachibowli
    isVerified: true,
    capacity: 0,
  },
];

// Test donations data with AI quality scores
const donations = [
  {
    items: [
      { name: 'Biryani', qty: 50, unit: 'portions' },
      { name: 'Raita', qty: 50, unit: 'portions' },
    ],
    cookedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now
    urgencyScore: 75,
    aiQualityScore: 88,
    aiFreshnessStatus: 'APPROVED',
    status: 'AVAILABLE',
    notes: 'Fresh biryani from lunch service',
    image: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
    photoUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
    mealsProvided: 50,
    carbonSavedKg: 25,
  },
  {
    items: [
      { name: 'Dal', qty: 30, unit: 'portions' },
      { name: 'Rice', qty: 30, unit: 'portions' },
      { name: 'Vegetables', qty: 30, unit: 'portions' },
    ],
    cookedAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
    expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000), // 6 hours from now
    urgencyScore: 60,
    aiQualityScore: 92,
    aiFreshnessStatus: 'APPROVED',
    status: 'ACCEPTED',
    notes: 'Vegetarian meal for 30 people',
    image: 'https://res.cloudinary.com/demo/image/upload/food-sample.jpg',
    photoUrl: 'https://res.cloudinary.com/demo/image/upload/food-sample.jpg',
    mealsProvided: 30,
    carbonSavedKg: 15,
  },
  {
    items: [
      { name: 'Chicken Curry', qty: 25, unit: 'portions' },
      { name: 'Naan', qty: 50, unit: 'pieces' },
    ],
    cookedAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
    expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
    urgencyScore: 90,
    aiQualityScore: 72,
    aiFreshnessStatus: 'APPROVED',
    status: 'AVAILABLE',
    notes: 'Non-veg dinner leftovers',
    image: 'https://res.cloudinary.com/demo/image/upload/chicken-curry.jpg',
    photoUrl: 'https://res.cloudinary.com/demo/image/upload/chicken-curry.jpg',
    mealsProvided: 25,
    carbonSavedKg: 12.5,
  },
  {
    items: [
      { name: 'Pasta', qty: 40, unit: 'portions' },
      { name: 'Garlic Bread', qty: 40, unit: 'pieces' },
    ],
    cookedAt: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
    expiresAt: new Date(Date.now() + 1 * 60 * 60 * 1000), // 1 hour from now
    urgencyScore: 95,
    aiQualityScore: 55,
    aiFreshnessStatus: 'REJECTED',
    status: 'AVAILABLE',
    notes: 'Pasta from dinner buffet',
    image: 'https://res.cloudinary.com/demo/image/upload/pasta.jpg',
    photoUrl: 'https://res.cloudinary.com/demo/image/upload/pasta.jpg',
    mealsProvided: 40,
    carbonSavedKg: 20,
  },
];

async function seedDatabase() {
  try {
    console.log('🌱 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    console.log('🗑️  Clearing existing data...');
    await User.deleteMany({});
    await Donation.deleteMany({});
    await Delivery.deleteMany({});

    // Create users
    console.log('👥 Creating users...');
    const createdUsers = [];
    for (const userData of users) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(userData.password, salt);
      
      const user = new User({
        ...userData,
        password: hashedPassword,
      });
      await user.save();
      createdUsers.push(user);
      console.log(`   ✓ Created ${userData.role}: ${userData.name} (${getUserLocationName(userData.location.coordinates)})`);
    }

    // Create donations
    console.log('\n🍽️  Creating donations...');
    const donors = createdUsers.filter(u => u.role === 'DONOR');
    const createdDonations = [];
    
    for (let i = 0; i < donations.length; i++) {
      const donationData = donations[i];
      const donor = donors[i % donors.length];
      
      const donation = new Donation({
        ...donationData,
        donorId: donor._id,
        donorType: donor.donorType,
        location: donor.location,
      });
      await donation.save();
      createdDonations.push(donation);
      console.log(`   ✓ Created donation: ${donationData.items.map(item => item.name).join(', ')} (AI Score: ${donationData.aiQualityScore}%)`);
    }

    // Create deliveries (gives the volunteer board jobs on launch)
    console.log('\n🚚 Creating deliveries...');
    const ngos = createdUsers.filter(u => u.role === 'NGO' && u.isVerified);
    const volunteers = createdUsers.filter(u => u.role === 'VOLUNTEER');
    const demoNGO = createdUsers.find(u => u.email === 'ngo@hungerrelief.org') || ngos[0];
    const demoVolunteer = createdUsers.find(u => u.email === 'volunteer@foodshare.ai') || volunteers[0];
    const otherVolunteer = volunteers.find(v => v._id.toString() !== String(demoVolunteer?._id)) || demoVolunteer;

    for (let i = 0; i < Math.min(2, createdDonations.length); i++) {
      const donation = createdDonations[i];
      const donor = donors[i % donors.length];
      const ngo = i % 2 === 0 ? demoNGO : (ngos[1] || demoNGO);
      const volunteer = i % 2 === 0 ? demoVolunteer : otherVolunteer;
      if (!donor || !ngo || !volunteer) continue;

      // Mark the donation as accepted with the assigned NGO so the whole flow is coherent
      donation.matchedNGO = ngo._id;
      donation.status = 'ACCEPTED';
      await donation.save();

      const meals = donation.items.reduce((sum, item) => sum + item.qty, 0);

      const delivery = new Delivery({
        donationId: donation._id,
        assignedNGO: ngo._id,
        volunteerId: volunteer._id,
        routeInfo: { distance: 4.2, duration: 15, steps: [] },
        routeCoordinates: [
          [donor.location.coordinates[1], donor.location.coordinates[0]],
          [ngo.location.coordinates[1], ngo.location.coordinates[0]],
        ],
        status: 'ASSIGNED',
        pickupLocation: donor.location,
        dropoffLocation: ngo.location,
        carbonSavedKg: 0,
        mealsProvided: meals,
      });
      await delivery.save();
      console.log(`   ✓ Created delivery: ${donation.items.map(item => item.name).join(', ')} → ${ngo.name} (volunteer: ${volunteer.name})`);
    }

    console.log('\n🎉 Seed completed successfully!');
    console.log('\n📋 Test accounts:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('\n🍽️  Restaurants (Donors):');
    console.log('   restaurant1@example.com / password123 (MG Road - Restaurant)');
    console.log('   restaurant2@example.com / password123 (Banjara Hills - Restaurant)');
    console.log('\n🏨 Hotels (Donors):');
    console.log('   hotel1@example.com / password123 (Jubilee Hills - Hotel)');
    console.log('   hotel2@example.com / password123 (Ameerpet - Hotel)');
    console.log('\n🏠 Hostels (Donors):');
    console.log('   hostel1@example.com / password123 (Madhapur - Hostel)');
    console.log('\n🏢 NGOs:');
    console.log('   ngo1@example.com / password123 (Jubilee Hills - Verified)');
    console.log('   ngo2@example.com / password123 (Ameerpet - Verified)');
    console.log('   ngo3@example.com / password123 (Madhapur - Pending)');
    console.log('\n🚚 Volunteers:');
    console.log('   volunteer1@example.com / password123 (Gachibowli)');
    console.log('   volunteer2@example.com / password123 (Kondapur)');
    console.log('\n👨‍💼 Admin:');
    console.log('   admin@example.com / password123 (HITEC City)');
    console.log('\n⚡ Convenience accounts (seeded as real MongoDB users):');
    console.log('   admin@foodshare.ai / password123 (Admin)');
    console.log('   donor@restaurant.com / password123 (Donor - Restaurant)');
    console.log('   ngo@hungerrelief.org / password123 (NGO)');
    console.log('   volunteer@foodshare.ai / password123 (Volunteer)');
    console.log('\n🚚 2 delivery jobs are seeded for the volunteer board');
    console.log('\n📍 All users are located in Hyderabad, India');
    console.log('═══════════════════════════════════════════════════════════');

  } catch (error) {
    console.error('❌ Seed failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

function getUserLocationName(coordinates) {
  const [lng, lat] = coordinates;
  for (const loc of HYDERABAD_LOCATIONS) {
    if (Math.abs(loc.lat - lat) < 0.001 && Math.abs(loc.lng - lng) < 0.001) {
      return loc.name;
    }
  }
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

// Run the seed
seedDatabase();