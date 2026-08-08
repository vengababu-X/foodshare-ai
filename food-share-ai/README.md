# FoodShare AI - Food Donation & Logistics Platform

A production-ready, full-stack Food Donation & Logistics Platform built with Next.js 14, Node.js/Express, MongoDB, Tailwind CSS, Socket.io, and Google Maps API.

## 🌟 Features

### Core Functionality
- **AI-Powered Matching**: Intelligent algorithm matches donors with NGOs based on proximity, capacity, and urgency
- **Real-Time Tracking**: Live GPS updates during food delivery
- **Role-Based Portals**: Dedicated dashboards for Donors, NGOs, Volunteers, and Admins
- **Carbon Offset Tracking**: Calculate environmental impact with CO2 savings metrics

### Portals

#### 🍽️ Donor Portal
- Express food posting form with photo upload
- Real-time driver map tracker
- ESG carbon-offset metric cards
- Donation status tracking

#### 🏢 NGO Portal
- Real-time incoming food dispatch feed
- 1-tap "Accept/Decline" modal
- Live countdown timer before reassignment
- Beneficiary capacity toggle

#### 🚚 Volunteer Portal
- Active delivery job board
- Interactive Google Maps route optimization
- Image capture modal for proof-of-delivery
- Real-time location updates

#### 👨‍💼 Admin Portal
- NGO account verification list
- Active platform heatmap
- Impact reporting export (Meals served, CO2 offset)
- User management

## 🚀 Tech Stack

- **Frontend**: Next.js 14 (App Router), Tailwind CSS, Framer Motion, Lucide Icons
- **Backend**: Express.js, Socket.io, Mongoose
- **Database**: MongoDB with GeoJSON support
- **Caching**: Upstash Redis
- **Maps**: Google Maps JavaScript API
- **Auth**: JWT-based authentication with role-based middleware

## 📁 Project Structure

```
food-share-ai/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── donor/              # Donor portal
│   │   ├── ngo/                # NGO portal
│   │   ├── volunteer/          # Volunteer portal
│   │   ├── admin/              # Admin portal
│   │   └── api/                # API routes
│   │       ├── auth/           # Authentication
│   │       ├── donations/      # Donation CRUD
│   │       ├── deliveries/     # Delivery management
│   │       └── users/          # User management
│   ├── components/             # Reusable components
│   │   ├── maps/               # Google Maps integration
│   │   ├── ui/                 # UI components
│   │   └── dashboards/         # Dashboard components
│   ├── lib/                    # Utilities and helpers
│   │   ├── db.ts               # MongoDB connection
│   │   └── socket.ts           # Socket.io setup
│   ├── models/                 # Mongoose schemas
│   │   ├── User.ts             # User model
│   │   ├── Donation.ts         # Donation model
│   │   └── Delivery.ts         # Delivery model
│   ├── services/               # Business logic
│   │   └── aiEngine.ts         # AI matching engine
│   ├── middleware/              # Auth middleware
│   │   └── auth.ts             # JWT authentication
│   └── types/                  # TypeScript types
│       └── index.ts            # Type definitions
├── scripts/
│   └── seed.js                 # Database seed script
├── public/                     # Static assets
└── .env.example                # Environment variables template
```

## 🛠️ Installation

### Prerequisites
- Node.js 18+ 
- MongoDB (local or Atlas)
- Google Maps API key

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd food-share-ai
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your configuration:
   - `MONGODB_URI`: Your MongoDB connection string
   - `JWT_SECRET`: Secret key for JWT tokens
   - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`: Your Google Maps API key

4. **Seed the database**
   ```bash
   node scripts/seed.js
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Open in browser**
   ```
   http://localhost:3000
   ```

## 🎯 Test Accounts

After running the seed script, use these test accounts:

### Restaurants (Donors)
- `restaurant1@example.com` / `password123`
- `restaurant2@example.com` / `password123`

### NGOs
- `ngo1@example.com` / `password123` (verified)
- `ngo2@example.com` / `password123` (verified)
- `ngo3@example.com` / `password123` (pending verification)

### Volunteers
- `volunteer1@example.com` / `password123`
- `volunteer2@example.com` / `password123`

### Admin
- `admin@example.com` / `password123`

All users are located in Hyderabad, India.

## 🧠 AI Matching Algorithm

The matching engine uses a weighted scoring system:

```
Score = (0.4 × ProximityScore) + (0.3 × ExpiryUrgencyScore) + (0.2 × NGOCapacityMatch) - (0.1 × TrafficDelayPenalty)
```

- **ProximityScore**: Distance-based scoring using Haversine formula
- **ExpiryUrgencyScore**: Time until food expires
- **NGOCapacityMatch**: Match between donation size and NGO capacity
- **TrafficDelayPenalty**: Estimated traffic delay penalty

### Escalation Queue
If the highest-ranked NGO doesn't accept within 5 minutes, the system automatically escalates to the next NGO in the queue.

## 📡 Real-Time Features

Socket.io powers the following real-time features:

- **Live Location Updates**: Volunteers broadcast location during transit
- **Donation Match Alerts**: Real-time notifications when donations are matched
- **Status Updates**: Instant updates for donation and delivery status changes
- **Push Notifications**: Audio alerts for critical events

## 🗺️ Map Integration

Google Maps integration provides:

- Interactive map with custom markers
- Real-time volunteer tracking
- Route optimization for deliveries
- Heatmap visualization for surplus/hunger zones
- Geospatial queries for nearby NGOs

## 🔐 Authentication & Authorization

- JWT-based authentication with 7-day expiration
- Role-based access control (DONOR, NGO, VOLUNTEER, ADMIN)
- Secure password hashing with bcrypt
- HTTP-only cookies for token storage

## 📊 Database Schema

### User
- `name`, `email`, `password`, `role`
- `phone`, `address`, `location` (GeoJSON)
- `isVerified`, `capacity` (for NGOs)

### Donation
- `donorId`, `items[]`, `cookedAt`, `expiresAt`
- `urgencyScore`, `status`, `location` (GeoJSON)
- `photoUrl`, `notes`
- `matchedNGO`, `assignedVolunteer`

### Delivery
- `donationId`, `assignedNGO`, `volunteerId`
- `routeInfo`, `proofPhotoUrl`, `completedAt`
- `carbonSavedKg`, `status`
- `pickupLocation`, `dropoffLocation`, `currentLocation`

## 🚀 Deployment

### Vercel (Frontend)
1. Push to GitHub
2. Import project in Vercel
3. Configure environment variables
4. Deploy

### Backend Options
- **Render**: Free tier available
- **Railway**: Easy deployment
- **DigitalOcean**: App Platform
- **AWS**: EC2/ECS

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit changes
4. Push to the branch
5. Create a Pull Request

## 📝 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- Next.js team for the amazing framework
- MongoDB for the flexible database
- Google Maps for location services
- Socket.io for real-time capabilities
- Tailwind CSS for beautiful styling

---

**Built with ❤️ to reduce food waste and fight hunger**