import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Privacy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0 relative">
      <main className="container max-w-4xl px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <motion.button 
            whileTap={{ scale: 0.9 }} 
            onClick={() => navigate(-1)} 
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5" />
          </motion.button>
          <h1 className="text-xl font-black text-foreground tracking-tight">Privacy Policy</h1>
        </div>

        <div className="bg-card rounded-3xl p-6 shadow-sm border border-border space-y-6 text-sm text-muted-foreground">
          <p>Last updated: {new Date().toLocaleDateString()}</p>
          
          <h2 className="text-lg font-bold text-foreground">1. Information We Collect</h2>
          <p>We collect information you provide directly to us, such as your name, email address, phone number, and location data when you use the Rozsewa application.</p>

          <h2 className="text-lg font-bold text-foreground">2. How We Use Your Information</h2>
          <p>We use the information we collect to provide, maintain, and improve our services, to process transactions, and to communicate with you about your bookings and our services.</p>

          <h2 className="text-lg font-bold text-foreground">3. Information Sharing</h2>
          <p>We share your information with service providers to facilitate your requested services. We do not sell your personal information to third parties.</p>

          <h2 className="text-lg font-bold text-foreground">4. Data Security</h2>
          <p>We implement reasonable security measures to protect your personal information from unauthorized access or disclosure.</p>

          <h2 className="text-lg font-bold text-foreground">5. Your Rights</h2>
          <p>You have the right to access, update, or delete your personal information by accessing your account settings or contacting our support team.</p>

          <h2 className="text-lg font-bold text-foreground">6. Contact Us</h2>
          <p>If you have any questions about this Privacy Policy, please contact us at support@rozsewa.in.</p>
        </div>
      </main>
    </div>
  );
};

export default Privacy;
