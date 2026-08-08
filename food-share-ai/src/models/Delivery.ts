import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IDelivery extends Document {
  donationId: mongoose.Types.ObjectId;
  assignedNGO: mongoose.Types.ObjectId;
  volunteerId: mongoose.Types.ObjectId;
  routeInfo: {
    distance: number; // in kilometers
    duration: number; // in minutes
    polyline?: string; // Encoded polyline
    steps: {
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
    }[];
  };
  routeCoordinates?: Array<[number, number]>; // Array of [lat, lng] for OpenStreetMap routing
  proofPhotoUrl?: string;
  pickupVerifiedAt?: Date;
  deliveryVerifiedAt?: Date;
  completedAt?: Date;
  carbonSavedKg: number;
  mealsProvided: number;
  status: 'ASSIGNED' | 'PICKUP_VERIFIED' | 'IN_TRANSIT' | 'DELIVERY_VERIFIED' | 'COMPLETED' | 'CANCELLED';
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
  estimatedArrival?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DeliverySchema = new Schema<IDelivery>(
  {
    donationId: {
      type: Schema.Types.ObjectId,
      ref: 'Donation',
      required: [true, 'Donation ID is required'],
    },
    assignedNGO: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Assigned NGO ID is required'],
    },
    volunteerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Volunteer ID is required'],
    },
    routeInfo: {
      distance: {
        type: Number,
        required: true,
        min: 0,
      },
      duration: {
        type: Number,
        required: true,
        min: 0,
      },
      polyline: {
        type: String,
      },
      steps: [
        {
          instruction: String,
          distance: Number,
          duration: Number,
          startLocation: {
            type: { type: String, enum: ['Point'], default: 'Point' },
            coordinates: [Number],
          },
          endLocation: {
            type: { type: String, enum: ['Point'], default: 'Point' },
            coordinates: [Number],
          },
        },
      ],
    },
    routeCoordinates: {
      type: [[Number]],
    },
    proofPhotoUrl: {
      type: String,
    },
    pickupVerifiedAt: {
      type: Date,
    },
    deliveryVerifiedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    carbonSavedKg: {
      type: Number,
      default: 0,
      min: 0,
    },
    mealsProvided: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['ASSIGNED', 'PICKUP_VERIFIED', 'IN_TRANSIT', 'DELIVERY_VERIFIED', 'COMPLETED', 'CANCELLED'],
      default: 'ASSIGNED',
    },
    pickupLocation: {
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
    dropoffLocation: {
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
    currentLocation: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        validate: {
          validator: (v: number[]) => !v || v.length === 2,
          message: 'Coordinates must be [longitude, latitude]',
        },
      },
    },
    estimatedArrival: {
      type: Date,
    },
    notes: {
      type: String,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
    },
  },
  {
    timestamps: true,
  }
);

// Create 2dsphere index for geospatial queries
DeliverySchema.index({ pickupLocation: '2dsphere' });
DeliverySchema.index({ dropoffLocation: '2dsphere' });
DeliverySchema.index({ currentLocation: '2dsphere' });

// Index for status queries
DeliverySchema.index({ status: 1 });

// Index for volunteer queries
DeliverySchema.index({ volunteerId: 1 });

// Index for NGO queries
DeliverySchema.index({ assignedNGO: 1 });

// Index for donation queries
DeliverySchema.index({ donationId: 1 });

const Delivery: Model<IDelivery> =
  mongoose.models.Delivery || mongoose.model<IDelivery>('Delivery', DeliverySchema);

export default Delivery;