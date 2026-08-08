import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IDonationItem {
  name: string;
  qty: number;
  unit: string;
}

export interface IDonation extends Document {
  donorId: mongoose.Types.ObjectId;
  donorType?: 'Restaurant' | 'Hotel' | 'Hostel' | 'Event' | 'Individual';
  items: IDonationItem[];
  cookedAt: Date;
  expiresAt: Date;
  urgencyScore: number;
  aiQualityScore?: number; // 0-100%
  aiFreshnessStatus?: 'APPROVED' | 'REJECTED';
  status: 'AVAILABLE' | 'ACCEPTED' | 'PICKED_UP' | 'DELIVERED' | 'EXPIRED' | 'PENDING' | 'MATCHED';
  image?: string; // Canonical Cloudinary image URL
  location: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  photoUrl?: string;
  notes?: string;
  pickupQrCode?: string; // QR code data for pickup verification
  deliveryQrCode?: string; // QR code data for delivery verification
  matchedNGO?: mongoose.Types.ObjectId;
  assignedVolunteer?: mongoose.Types.ObjectId;
  mealsProvided?: number;
  carbonSavedKg?: number;
  createdAt: Date;
  updatedAt: Date;
}

const DonationItemSchema = new Schema<IDonationItem>({
  name: {
    type: String,
    required: [true, 'Item name is required'],
    trim: true,
  },
  qty: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [0, 'Quantity cannot be negative'],
  },
  unit: {
    type: String,
    required: [true, 'Unit is required'],
    enum: ['kg', 'g', 'pieces', 'liters', 'ml', 'portions'],
    default: 'portions',
  },
});

const DonationSchema = new Schema<IDonation>(
  {
    donorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Donor ID is required'],
    },
    donorType: {
      type: String,
      enum: ['Restaurant', 'Hotel', 'Hostel', 'Event', 'Individual'],
    },
    items: {
      type: [DonationItemSchema],
      required: [true, 'At least one item is required'],
      validate: {
        validator: (v: IDonationItem[]) => v.length > 0,
        message: 'At least one item is required',
      },
    },
    cookedAt: {
      type: Date,
      required: [true, 'Cooking time is required'],
    },
    expiresAt: {
      type: Date,
      required: [true, 'Expiration time is required'],
    },
    urgencyScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    aiQualityScore: {
      type: Number,
      min: 0,
      max: 100,
    },
    aiFreshnessStatus: {
      type: String,
      enum: ['APPROVED', 'REJECTED'],
    },
    status: {
      type: String,
      enum: ['AVAILABLE', 'ACCEPTED', 'PICKED_UP', 'DELIVERED', 'EXPIRED', 'PENDING', 'MATCHED'],
      default: 'AVAILABLE',
    },
    image: {
      type: String,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator: (v: number[]) => v.length === 2,
          message: 'Coordinates must be [longitude, latitude]',
        },
      },
    },
    photoUrl: {
      type: String,
    },
    notes: {
      type: String,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
    },
    pickupQrCode: {
      type: String,
    },
    deliveryQrCode: {
      type: String,
    },
    matchedNGO: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    assignedVolunteer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    mealsProvided: {
      type: Number,
      default: 0,
    },
    carbonSavedKg: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Create 2dsphere index for geospatial queries
DonationSchema.index({ location: '2dsphere' });

// Index for status queries
DonationSchema.index({ status: 1 });

// Index for donor queries
DonationSchema.index({ donorId: 1 });

// Index for expiration queries
DonationSchema.index({ expiresAt: 1 });

// Index for urgency score
DonationSchema.index({ urgencyScore: -1 });

const Donation: Model<IDonation> =
  mongoose.models.Donation || mongoose.model<IDonation>('Donation', DonationSchema);

export default Donation;