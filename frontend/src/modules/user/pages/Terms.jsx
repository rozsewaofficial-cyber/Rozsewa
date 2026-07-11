import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Terms = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0 relative">
      <main className="container max-w-4xl px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <motion.button 
            whileTap={{ scale: 0.9 }} 
            onClick={() => navigate('/profile')} 
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5" />
          </motion.button>
          <h1 className="text-xl font-black text-foreground tracking-tight">Terms & Conditions</h1>
        </div>

        <div className="bg-card rounded-3xl p-6 shadow-sm border border-border space-y-6 text-sm text-muted-foreground">
          <p>Last updated: {new Date().toLocaleDateString()}</p>
          
          <h2 className="text-lg font-bold text-foreground">1. Acceptance of Terms</h2>
          <p>By accessing and using Rozsewa, you accept and agree to be bound by the terms and provision of this agreement.</p>

          <h2 className="text-lg font-bold text-foreground">2. Description of Service</h2>
          <p>Rozsewa provides a platform connecting users with service providers. We act as an intermediary and are not responsible for the actual services provided by independent partners.</p>

          <h2 className="text-lg font-bold text-foreground">3. User Obligations</h2>
          <p>Users must provide accurate information when registering and booking services. Any misuse of the platform may result in account termination.</p>

          <h2 className="text-lg font-bold text-foreground">4. Payment Terms</h2>
          <p>Payments for services must be made through the approved channels within the app. Refunds and cancellations are subject to our cancellation policy.</p>

          <h2 className="text-lg font-bold text-foreground">5. Limitation of Liability</h2>
          <p>Rozsewa shall not be liable for any indirect, incidental, special, consequential or punitive damages resulting from your access to or use of the service.</p>

          <h2 className="text-lg font-bold text-foreground">6. Changes to Terms</h2>
          <p>We reserve the right to modify these terms at any time. We will notify users of any significant changes.</p>
        </div>
      </main>
    </div>
  );
};

export default Terms;
