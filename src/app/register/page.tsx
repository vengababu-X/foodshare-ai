'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  UserPlus,
  Mail,
  Lock,
  User as UserIcon,
  ArrowRight,
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
  Heart,
  Users,
  Truck,
  Shield,
  Info,
} from 'lucide-react';

const ROLE_HOME: Record<string, string> = {
  ADMIN: '/admin',
  DONOR: '/donor',
  NGO: '/ngo',
  VOLUNTEER: '/volunteer',
};

const ROLE_OPTIONS = [
  {
    value: 'DONOR',
    label: 'Donor',
    description: 'Share surplus food',
    icon: Heart,
    active: 'border-orange-300 bg-orange-50 ring-2 ring-orange-200',
    iconBg: 'bg-gradient-to-br from-orange-500 to-red-500',
  },
  {
    value: 'NGO',
    label: 'NGO',
    description: 'Receive & distribute',
    icon: Users,
    active: 'border-blue-300 bg-blue-50 ring-2 ring-blue-200',
    iconBg: 'bg-gradient-to-br from-blue-500 to-cyan-500',
  },
  {
    value: 'VOLUNTEER',
    label: 'Volunteer',
    description: 'Deliver donations',
    icon: Truck,
    active: 'border-purple-300 bg-purple-50 ring-2 ring-purple-200',
    iconBg: 'bg-gradient-to-br from-purple-500 to-pink-500',
  },
  {
    value: 'ADMIN',
    label: 'Admin',
    description: 'Manage platform',
    icon: Shield,
    active: 'border-gray-300 bg-gray-50 ring-2 ring-gray-200',
    iconBg: 'bg-gradient-to-br from-gray-600 to-gray-800',
  },
];

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<string>('DONOR');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!name.trim() || !email.trim() || !password) {
      setError('Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          role,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        if (response.status === 409) {
          setError('An account with this email already exists. Try logging in instead.');
        } else if (response.status === 400) {
          setError(data.error || 'Please check your details and try again.');
        } else {
          setError(data.error || 'Registration failed. Please try again.');
        }
        return;
      }

      // Session cookie is already set by the server — go straight to the
      // user's dashboard with a personalized welcome banner.
      const roleHome = ROLE_HOME[role] || '/';
      setSuccessMessage(`Account created! Welcome, ${data.data?.user?.name || name}!`);

      setTimeout(() => {
        router.push(`${roleHome}?welcome=${encodeURIComponent(name.trim())}`);
        router.refresh();
      }, 700);
    } catch (networkError) {
      console.error('Registration network error:', networkError);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl border border-green-100 overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-8 text-center">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 ring-4 ring-white/30">
            <UserPlus className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Create your account</h1>
          <p className="text-green-100 mt-1">
            Join FoodShare AI and start making a difference
          </p>
        </div>

        <div className="p-8">
          {/* Error / Success messages */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 p-4 rounded-xl flex items-start gap-3 bg-red-50 border border-red-200 text-red-800"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span className="text-sm">{error}</span>
            </motion.div>
          )}

          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 p-4 rounded-xl flex items-center gap-3 bg-green-50 border border-green-200 text-green-800"
            >
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{successMessage}</span>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name
              </label>
              <div className="relative">
                <UserIcon className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError(null);
                  }}
                  placeholder="e.g. Spice Garden Restaurant"
                  className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-shadow"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError(null);
                  }}
                  placeholder="you@example.com"
                  className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-shadow"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  placeholder="At least 6 characters"
                  className="w-full pl-12 pr-12 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-shadow"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {password && password.length > 0 && password.length < 6 && (
                <p className="mt-1 text-xs text-amber-600">
                  Password should be at least 6 characters.
                </p>
              )}
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                I want to join as
              </label>
              <div className="grid grid-cols-2 gap-3">
                {ROLE_OPTIONS.map((option) => {
                  const selected = role === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setRole(option.value);
                        setError(null);
                      }}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all duration-200 ${
                        selected
                          ? option.active
                          : 'border-gray-200 hover:border-green-200 bg-white'
                      }`}
                    >
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 ${option.iconBg}`}
                      >
                        <option.icon className="w-5 h-5" />
                      </div>
                      <div className="text-left leading-tight">
                        <div className="text-sm font-semibold text-gray-900">
                          {option.label}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {option.description}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-400">
                <Info className="w-3.5 h-3.5" />
                You&apos;ll be taken straight to your dashboard after signing up.
              </p>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center px-6 py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-5 w-5 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Creating account...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <UserPlus className="w-5 h-5" />
                  Create Account
                  <ArrowRight className="w-5 h-5" />
                </span>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600">
            Already have an account?{' '}
            <a
              href="/login"
              className="font-semibold text-green-600 hover:text-green-700 hover:underline transition-colors"
            >
              Log in
            </a>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
