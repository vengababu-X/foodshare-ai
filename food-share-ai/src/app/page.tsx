'use client';

import { motion } from 'framer-motion';
import { 
  Truck, 
  Users, 
  MapPin, 
  Clock, 
  Leaf, 
  Heart,
  ArrowRight,
  CheckCircle
} from 'lucide-react';

const features = [
  {
    icon: MapPin,
    title: 'Smart Matching',
    description: 'AI-powered matching connects donors with the nearest NGOs based on proximity, capacity, and urgency.',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    icon: Clock,
    title: 'Real-Time Tracking',
    description: 'Track food donations from pickup to delivery with live GPS updates and status notifications.',
    color: 'from-purple-500 to-pink-500',
  },
  {
    icon: Users,
    title: 'Role-Based Portals',
    description: 'Dedicated dashboards for donors, NGOs, volunteers, and admins with tailored functionality.',
    color: 'from-orange-500 to-red-500',
  },
  {
    icon: Leaf,
    title: 'Carbon Offset',
    description: 'Calculate and track environmental impact with CO2 savings metrics for every delivery.',
    color: 'from-green-500 to-emerald-500',
  },
];

const stats = [
  { value: '10K+', label: 'Meals Donated' },
  { value: '500+', label: 'NGOs Connected' },
  { value: '2K+', label: 'Volunteers' },
  { value: '50+', label: 'Cities Covered' },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
    },
  },
};

export default function HomePage() {
  return (
    <div className="space-y-16">
      {/* Hero Section */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center py-12"
      >
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl"
        >
          <Truck className="w-10 h-10 text-white" />
        </motion.div>
        
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
          <span className="bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
            FoodShare AI
          </span>
        </h1>
        
        <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
          Connecting donors with NGOs and volunteers to reduce food waste and fight hunger 
          through intelligent matching and real-time logistics.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="/donor"
            className="inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
          >
            <Heart className="w-5 h-5 mr-2" />
            Donate Food
            <ArrowRight className="w-5 h-5 ml-2" />
          </a>
          <a
            href="/ngo"
            className="inline-flex items-center justify-center px-8 py-4 bg-white text-green-600 font-semibold rounded-xl shadow-lg hover:shadow-xl border-2 border-green-200 hover:border-green-300 transform hover:-translate-y-0.5 transition-all duration-200"
          >
            <Users className="w-5 h-5 mr-2" />
            Join as NGO
          </a>
        </div>
      </motion.section>

      {/* Stats Section */}
      <motion.section
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        className="grid grid-cols-2 md:grid-cols-4 gap-6"
      >
        {stats.map((stat, index) => (
          <motion.div
            key={index}
            variants={itemVariants}
            className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 text-center shadow-lg border border-green-100"
          >
            <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
              {stat.value}
            </div>
            <div className="text-gray-600 mt-2">{stat.label}</div>
          </motion.div>
        ))}
      </motion.section>

      {/* Features Section */}
      <motion.section
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
      >
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
          How It Works
        </h2>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-green-100 hover:shadow-xl transition-shadow duration-300"
            >
              <div className={`w-14 h-14 bg-gradient-to-br ${feature.color} rounded-xl flex items-center justify-center mb-4 shadow-lg`}>
                <feature.icon className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
              <p className="text-gray-600">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* CTA Section */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-3xl p-8 md:p-12 text-white text-center"
      >
        <h2 className="text-3xl font-bold mb-4">Ready to Make a Difference?</h2>
        <p className="text-green-100 mb-8 max-w-2xl mx-auto">
          Join thousands of donors, NGOs, and volunteers working together to reduce food waste 
          and ensure no one goes hungry.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <div className="flex items-center justify-center space-x-2 bg-white/20 rounded-lg px-4 py-2">
            <CheckCircle className="w-5 h-5" />
            <span>Free to use</span>
          </div>
          <div className="flex items-center justify-center space-x-2 bg-white/20 rounded-lg px-4 py-2">
            <CheckCircle className="w-5 h-5" />
            <span>Real-time tracking</span>
          </div>
          <div className="flex items-center justify-center space-x-2 bg-white/20 rounded-lg px-4 py-2">
            <CheckCircle className="w-5 h-5" />
            <span>AI-powered matching</span>
          </div>
        </div>
      </motion.section>

      {/* Role Selection */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-8">
          Choose Your Role
        </h2>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <a
            href="/donor"
            className="group bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-green-100 hover:border-green-300 hover:shadow-xl transition-all duration-300"
          >
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Heart className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">I am a Donor</h3>
            <p className="text-gray-600 text-sm">
              Share surplus food from restaurants, events, or homes with those in need.
            </p>
          </a>
          
          <a
            href="/ngo"
            className="group bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-green-100 hover:border-green-300 hover:shadow-xl transition-all duration-300"
          >
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Users className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">I am an NGO</h3>
            <p className="text-gray-600 text-sm">
              Receive and distribute food donations to communities in need.
            </p>
          </a>
          
          <a
            href="/volunteer"
            className="group bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-green-100 hover:border-green-300 hover:shadow-xl transition-all duration-300"
          >
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Truck className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">I am a Volunteer</h3>
            <p className="text-gray-600 text-sm">
              Help deliver food donations from donors to NGOs.
            </p>
          </a>
          
          <a
            href="/admin"
            className="group bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-green-100 hover:border-green-300 hover:shadow-xl transition-all duration-300"
          >
            <div className="w-12 h-12 bg-gradient-to-br from-gray-600 to-gray-800 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <MapPin className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Admin Dashboard</h3>
            <p className="text-gray-600 text-sm">
              Manage users, verify NGOs, and view platform analytics.
            </p>
          </a>
        </div>
      </motion.section>
    </div>
  );
}