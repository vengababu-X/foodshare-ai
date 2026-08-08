import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: 'DONOR' | 'NGO' | 'VOLUNTEER' | 'ADMIN';
  status: 'ACTIVE' | 'SUSPENDED'; // Account state for admin suspension
  donorType?: 'Restaurant' | 'Hotel' | 'Hostel' | 'Event' | 'Individual';
  phone: string;
  location: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  isVerified: boolean;
  capacity: number; // For NGOs
  avatar?: string;
  rating?: number; // Average donor rating
  totalDonations?: number;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // Don't return password by default
    },
    role: {
      type: String,
      enum: ['DONOR', 'NGO', 'VOLUNTEER', 'ADMIN'],
      required: [true, 'Role is required'],
    },
    donorType: {
      type: String,
      enum: ['Restaurant', 'Hotel', 'Hostel', 'Event', 'Individual'],
      required: function(this: IUser) {
        return this.role === 'DONOR';
      },
    },
    phone: {
      type: String,
      trim: true,
      default: '',
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
    isVerified: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'SUSPENDED'],
      default: 'ACTIVE',
    },
    capacity: {
      type: Number,
      default: 0,
      min: [0, 'Capacity cannot be negative'],
    },
    avatar: {
      type: String,
    },
    rating: {
      type: Number,
      default: 5.0,
      min: 0,
      max: 5,
    },
    totalDonations: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Create 2dsphere index for geospatial queries
UserSchema.index({ location: '2dsphere' });

// Index for faster role-based queries
UserSchema.index({ role: 1 });

// Index for email lookup
UserSchema.index({ email: 1 }, { unique: true });

const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;