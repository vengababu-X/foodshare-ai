// User types
export type UserRole = 'DONOR' | 'NGO' | 'VOLUNTEER' | 'ADMIN';

export interface User {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  phone: string;
  address: string;
  location: {
    type: 'Point';
    coordinates: [number, number];
  };
  isVerified: boolean;
  capacity: number;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

// Donation types
export type DonationStatus =
  | 'AVAILABLE'
  | 'ACCEPTED'
  | 'PICKED_UP'
  | 'DELIVERED'
  | 'EXPIRED'
  | 'PENDING'
  | 'MATCHED';
export type FoodUnit = 'kg' | 'g' | 'pieces' | 'liters' | 'ml' | 'portions';

export interface DonationItem {
  name: string;
  qty: number;
  unit: FoodUnit;
}

export interface Donation {
  _id: string;
  donorId: string | User;
  items: DonationItem[];
  cookedAt: string;
  expiresAt: string;
  urgencyScore: number;
  status: DonationStatus;
  location: {
    type: 'Point';
    coordinates: [number, number];
  };
  image?: string;
  photoUrl?: string;
  notes?: string;
  matchedNGO?: string | User;
  assignedVolunteer?: string | User;
  createdAt: string;
  updatedAt: string;
}

// Delivery types
export type DeliveryStatus =
  | 'ASSIGNED'
  | 'PICKUP_VERIFIED'
  | 'IN_TRANSIT'
  | 'DELIVERY_VERIFIED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface RouteStep {
  instruction: string;
  distance: number;
  duration: number;
  startLocation: {
    type: 'Point';
    coordinates: [number, number];
  };
  endLocation: {
    type: 'Point';
    coordinates: [number, number];
  };
}

export interface RouteInfo {
  distance: number;
  duration: number;
  polyline?: string;
  steps: RouteStep[];
}

export interface Delivery {
  _id: string;
  donationId: string | Donation;
  assignedNGO: string | User;
  volunteerId: string | User;
  routeInfo: RouteInfo;
  routeCoordinates?: Array<[number, number]>;
  proofPhotoUrl?: string;
  pickupVerifiedAt?: string;
  deliveryVerifiedAt?: string;
  completedAt?: string;
  carbonSavedKg: number;
  mealsProvided?: number;
  status: DeliveryStatus;
  pickupLocation: {
    type: 'Point';
    coordinates: [number, number];
  };
  dropoffLocation: {
    type: 'Point';
    coordinates: [number, number];
  };
  currentLocation?: {
    type: 'Point';
    coordinates: [number, number];
  };
  estimatedArrival?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// Socket.io event types
export interface SocketEvents {
  // Location updates
  'volunteer:location:update': (data: {
    volunteerId: string;
    deliveryId: string;
    location: { lat: number; lng: number };
  }) => void;

  // Donation events
  'donation:matched': (data: {
    donationId: string;
    ngoId: string;
    donorId: string;
  }) => void;

  'donation:status:update': (data: {
    donationId: string;
    status: DonationStatus;
  }) => void;

  // Delivery events
  'delivery:assigned': (data: {
    deliveryId: string;
    volunteerId: string;
    ngoId: string;
  }) => void;

  'delivery:completed': (data: {
    deliveryId: string;
    donationId: string;
  }) => void;

  // Notification events
  'notification:new': (data: {
    type: 'info' | 'warning' | 'success' | 'error';
    title: string;
    message: string;
    userId: string;
  }) => void;
}

// Map types
export interface Coordinates {
  lat: number;
  lng: number;
}

export interface MapMarker {
  id: string;
  position: Coordinates;
  title: string;
  type: 'donation' | 'ngo' | 'volunteer' | 'pickup' | 'dropoff';
  info?: string;
}