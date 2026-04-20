import React, { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock, AlertCircle } from 'lucide-react';
import { toast } from "sonner";
import axios from 'axios';

const PinModal = ({ isOpen, onClose, onSuccess }) => {
    const [pin, setPin] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!pin) return;

        setLoading(true);
        setError('');

        try {
            const auth = JSON.parse(localStorage.getItem('rozsewa_auth_admin'));
            const response = await axios.post(`${import.meta.env.VITE_API_URL}/admin/verify-pin`, { pin }, {
                headers: { Authorization: `Bearer ${auth?.token}` }
            });

            if (response.data.success) {
                toast.success("PIN Verified Successfully");
                onSuccess();
                onClose();
                setPin('');
            }
        } catch (err) {
            setError(err.response?.data?.message || "Invalid PIN");
            setPin('');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <div className="mx-auto w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                        <Lock className="h-6 w-6 text-emerald-600" />
                    </div>
                    <DialogTitle className="text-center text-xl font-bold">Enter Super Admin PIN</DialogTitle>
                    <p className="text-center text-gray-500 text-sm">Please enter your 4-digit security PIN to access this section.</p>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6 pt-4">
                    <div className="flex flex-col items-center gap-4">
                        <Input
                            type="password"
                            placeholder="••••"
                            value={pin}
                            onChange={(e) => setPin(e.target.value)}
                            className="text-center text-2xl tracking-[1em] h-14 font-bold"
                            maxLength={4}
                            autoFocus
                        />
                        {error && (
                            <div className="flex items-center gap-2 text-red-500 text-sm font-medium">
                                <AlertCircle className="h-4 w-4" />
                                {error}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-3">
                        <Button
                            type="submit"
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 font-bold"
                            disabled={loading || pin.length < 4}
                        >
                            {loading ? "Verifying..." : "Unlock Section"}
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            className="w-full h-12 font-bold"
                            onClick={onClose}
                        >
                            Cancel
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default PinModal;
