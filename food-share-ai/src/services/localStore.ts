import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

/**
 * Local JSON-file fallback store ("Smart Hybrid" mode).
 *
 * When MongoDB is unreachable (empty/misconfigured MONGODB_URI, blocked
 * network, Atlas IP allowlist) the registration, login and order flows
 * transparently switch to flat JSON files so the app never crashes on a
 * developer machine:
 *   data/users.json
 *   data/donations.json
 *   data/deliveries.json
 *
 * NOTE: The filesystem is ephemeral on serverless hosts (Vercel), so this is
 * a local/dev resilience layer — production should always use MongoDB.
 */

const DATA_DIR = path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const DONATIONS_FILE = path.join(DATA_DIR, 'donations.json');
const DELIVERIES_FILE = path.join(DATA_DIR, 'deliveries.json');

const DEFAULT_COORDS: [number, number] = [78.4867, 17.385]; // Hyderabad, India

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readJson<T = any>(file: string, fallback: T): T {
  try {
    ensureDir();
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as T;
  } catch (error) {
    console.error(`[local-store] Failed to read ${file}:`, error);
    return fallback;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function writeJson<T = any>(file: string, data: T): void {
  try {
    ensureDir();
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(`[local-store] Failed to write ${file}:`, error);
  }
}

// ── Users ─────────────────────────────────────────────────────────────────

export interface LocalUser {
  id: string;
  name: string;
  email: string;
  password: string; // bcrypt hash
  role: 'DONOR' | 'NGO' | 'VOLUNTEER' | 'ADMIN';
  phone?: string;
  donorType?: string;
  coordinates?: [number, number];
  capacity?: number;
  isVerified?: boolean;
  status?: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
}

function allUsers(): LocalUser[] {
  return readJson<LocalUser[]>(USERS_FILE, []);
}

export function localFindUserByEmail(email: string): LocalUser | null {
  const normalized = email.trim().toLowerCase();
  return allUsers().find((u) => u.email === normalized) || null;
}

export function localFindUserById(id: string): LocalUser | null {
  return allUsers().find((u) => u.id === id) || null;
}

export function localListUsers(): LocalUser[] {
  return allUsers().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function localListVolunteers(): LocalUser[] {
  return allUsers().filter((u) => u.role === 'VOLUNTEER');
}

/** Patch a user in the local store (admin approve/suspend, self profile). */
export function localUpdateUser(
  id: string,
  patch: Partial<LocalUser>
): LocalUser | null {
  const users = allUsers();
  const index = users.findIndex((u) => u.id === id);
  if (index === -1) return null;
  users[index] = { ...users[index], ...patch };
  writeJson(USERS_FILE, users);
  return users[index];
}

export function localCreateUser(input: {
  name: string;
  email: string;
  password: string;
  role: 'DONOR' | 'NGO' | 'VOLUNTEER' | 'ADMIN';
  phone?: string;
  donorType?: string;
}): LocalUser {
  const users = allUsers();
  const normalized = input.email.trim().toLowerCase();
  if (users.some((u) => u.email === normalized)) {
    throw new Error('An account with this email already exists. Try logging in instead.');
  }

  const user: LocalUser = {
    id: `u_${Date.now().toString()}${Math.random().toString(36).slice(2, 8)}`,
    name: input.name.trim(),
    email: normalized,
    password: bcrypt.hashSync(input.password, 10),
    role: input.role || 'DONOR',
    phone: input.phone || '',
    donorType: input.role === 'DONOR' ? input.donorType || 'Individual' : undefined,
    coordinates: DEFAULT_COORDS,
    capacity: input.role === 'NGO' ? 0 : 0,
    isVerified: true,
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  };

  users.push(user);
  writeJson(USERS_FILE, users);
  return user;
}

// Note: in local mode all accounts (including NGOs) are stored as verified —
// this is a dev sandbox with no admin approval flow. The MongoDB path keeps
// strict governance (new NGOs require admin approval before accepting).

export function localVerifyPassword(user: LocalUser, password: string): boolean {
  try {
    return bcrypt.compareSync(password, user.password);
  } catch {
    return false;
  }
}

/** Shape compatible with what the API routes return as `user`. */
export function localSanitizeUser(user: LocalUser) {
  return {
    _id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone || '',
    capacity: user.capacity ?? 0,
    isVerified: user.isVerified ?? false,
    location: { type: 'Point', coordinates: user.coordinates || DEFAULT_COORDS },
    createdAt: user.createdAt,
  };
}

// ── Donations ─────────────────────────────────────────────────────────────

export interface LocalDonationItem {
  name: string;
  qty: number;
  unit: string;
}

export interface LocalDonation {
  id: string;
  donorId: string;
  donorEmail: string;
  donorType?: string;
  items: LocalDonationItem[];
  cookedAt: string;
  expiresAt: string;
  urgencyScore: number;
  aiQualityScore?: number;
  status: 'AVAILABLE' | 'ACCEPTED' | 'PICKED_UP' | 'DELIVERED';
  image?: string;
  notes?: string;
  coordinates?: [number, number];
  matchedNGO?: string;
  createdAt: string;
}

function allDonations(): LocalDonation[] {
  return readJson<LocalDonation[]>(DONATIONS_FILE, []);
}

export function localListDonations(status?: string, limit = 50): LocalDonation[] {
  return allDonations()
    .filter((d) => (status ? d.status === status : true))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, limit);
}

export function localGetDonation(id: string): LocalDonation | null {
  return allDonations().find((d) => d.id === id) || null;
}

export function localCreateDonation(input: {
  donorId: string;
  donorEmail: string;
  donorType?: string;
  items: LocalDonationItem[];
  cookedAt: string;
  expiresAt: string;
  urgencyScore: number;
  image?: string;
  notes?: string;
  coordinates?: [number, number];
}): LocalDonation {
  const donations = allDonations();
  const donation: LocalDonation = {
    id: `don_${Date.now().toString()}${Math.random().toString(36).slice(2, 6)}`,
    donorId: input.donorId,
    donorEmail: input.donorEmail,
    donorType: input.donorType,
    items: input.items,
    cookedAt: input.cookedAt,
    expiresAt: input.expiresAt,
    urgencyScore: input.urgencyScore,
    aiQualityScore: Math.max(0, Math.min(100, Math.round(input.urgencyScore))),
    status: 'AVAILABLE',
    image: input.image,
    notes: input.notes,
    coordinates: input.coordinates,
    createdAt: new Date().toISOString(),
  };
  donations.push(donation);
  writeJson(DONATIONS_FILE, donations);
  return donation;
}

export function localUpdateDonation(
  id: string,
  patch: Partial<LocalDonation>
): LocalDonation | null {
  const donations = allDonations();
  const index = donations.findIndex((d) => d.id === id);
  if (index === -1) return null;
  donations[index] = { ...donations[index], ...patch };
  writeJson(DONATIONS_FILE, donations);
  return donations[index];
}

/** Populate a donation with its donor (mirrors Mongoose populate). */
export function localDonationToResponse(donation: LocalDonation) {
  const donor = localFindUserById(donation.donorId);
  return {
    _id: donation.id,
    donorId: donor
      ? {
          _id: donor.id,
          name: donor.name,
          email: donor.email,
          phone: donor.phone || '',
          location: { type: 'Point', coordinates: donor.coordinates || DEFAULT_COORDS },
        }
      : { _id: donation.donorId, name: donation.donorEmail, email: donation.donorEmail },
    donorType: donation.donorType,
    items: donation.items,
    cookedAt: donation.cookedAt,
    expiresAt: donation.expiresAt,
    urgencyScore: donation.urgencyScore,
    aiQualityScore: donation.aiQualityScore,
    status: donation.status,
    image: donation.image,
    photoUrl: donation.image,
    notes: donation.notes,
    location: {
      type: 'Point',
      coordinates: donation.coordinates || DEFAULT_COORDS,
    },
    matchedNGO: donation.matchedNGO,
    createdAt: donation.createdAt,
  };
}

// ── Deliveries ────────────────────────────────────────────────────────────

export interface LocalDelivery {
  id: string;
  donationId: string;
  assignedNGO: string;
  volunteerId: string;
  status: 'ASSIGNED' | 'IN_TRANSIT' | 'COMPLETED';
  routeInfo: { distance: number; duration: number };
  pickupLocation: { type: 'Point'; coordinates: [number, number] };
  dropoffLocation: { type: 'Point'; coordinates: [number, number] };
  completedAt?: string;
  mealsProvided?: number;
  createdAt: string;
}

function allDeliveries(): LocalDelivery[] {
  return readJson<LocalDelivery[]>(DELIVERIES_FILE, []);
}

export function localListDeliveries(volunteerId?: string, limit = 50): LocalDelivery[] {
  return allDeliveries()
    .filter((d) => (volunteerId ? d.volunteerId === volunteerId : true))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, limit);
}

export function localGetDelivery(id: string): LocalDelivery | null {
  return allDeliveries().find((d) => d.id === id) || null;
}

export function localCreateDelivery(input: {
  donationId: string;
  assignedNGO: string;
  volunteerId: string;
  routeInfo?: { distance: number; duration: number };
  pickupLocation?: { type: 'Point'; coordinates: [number, number] };
  dropoffLocation?: { type: 'Point'; coordinates: [number, number] };
}): LocalDelivery {
  const deliveries = allDeliveries();
  const delivery: LocalDelivery = {
    id: `del_${Date.now().toString()}${Math.random().toString(36).slice(2, 6)}`,
    donationId: input.donationId,
    assignedNGO: input.assignedNGO,
    volunteerId: input.volunteerId,
    status: 'ASSIGNED',
    routeInfo: input.routeInfo || { distance: 0, duration: 0 },
    pickupLocation:
      input.pickupLocation || { type: 'Point', coordinates: DEFAULT_COORDS },
    dropoffLocation:
      input.dropoffLocation || { type: 'Point', coordinates: DEFAULT_COORDS },
    createdAt: new Date().toISOString(),
  };
  deliveries.push(delivery);
  writeJson(DELIVERIES_FILE, deliveries);
  return delivery;
}

export function localUpdateDelivery(
  id: string,
  patch: Partial<LocalDelivery>
): LocalDelivery | null {
  const deliveries = allDeliveries();
  const index = deliveries.findIndex((d) => d.id === id);
  if (index === -1) return null;
  deliveries[index] = { ...deliveries[index], ...patch };
  writeJson(DELIVERIES_FILE, deliveries);
  return deliveries[index];
}

/** Populate a delivery with donation + NGO + volunteer (mirrors populate). */
export function localDeliveryToResponse(delivery: LocalDelivery) {
  const donation = localGetDonation(delivery.donationId);
  const donationResp = donation ? localDonationToResponse(donation) : null;
  const ngo = localFindUserById(delivery.assignedNGO);
  const volunteer = localFindUserById(delivery.volunteerId);
  return {
    _id: delivery.id,
    donationId: donationResp,
    assignedNGO: ngo
      ? { _id: ngo.id, name: ngo.name, phone: ngo.phone || '', location: ngo.coordinates }
      : null,
    volunteerId: volunteer
      ? { _id: volunteer.id, name: volunteer.name }
      : null,
    status: delivery.status,
    routeInfo: delivery.routeInfo,
    pickupLocation: delivery.pickupLocation,
    dropoffLocation: delivery.dropoffLocation,
    completedAt: delivery.completedAt,
    mealsProvided: delivery.mealsProvided,
    createdAt: delivery.createdAt,
  };
}

export default {
  localFindUserByEmail,
  localFindUserById,
  localListUsers,
  localListVolunteers,
  localUpdateUser,
  localCreateUser,
  localVerifyPassword,
  localSanitizeUser,
  localListDonations,
  localGetDonation,
  localCreateDonation,
  localUpdateDonation,
  localDonationToResponse,
  localListDeliveries,
  localGetDelivery,
  localCreateDelivery,
  localUpdateDelivery,
  localDeliveryToResponse,
};
