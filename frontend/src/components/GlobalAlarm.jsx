import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '@/context/SocketContext';
import { useAuth } from '@/context/AuthContext';
import IncomingRequestModal from '@/modules/provider/components/IncomingRequestModal';
import IncomingLeadModal from '@/modules/provider/components/IncomingLeadModal';
import ScheduleAcceptedModal from '@/modules/provider/components/ScheduleAcceptedModal';
import BookingReminderModal from '@/modules/provider/components/BookingReminderModal';
import AdminSosModal from './AdminSosModal';

const GlobalAlarm = () => {
    const socketData = useSocket();
    const { user } = useAuth();
    const navigate = useNavigate();

    // Safety fallback for Vite HMR issues where context might be temporarily lost
    if (!socketData || !user) return null;

    const path = window.location.pathname;

    // 1. For Admins: Show critical SOS alarm overlay on any admin page
    const isAdmin = user.role === 'admin' || user.role === 'superadmin' || user.role === 'supervisor';
    if (path.startsWith('/admin') && isAdmin && socketData.activeSosAlert) {
        return (
            <AdminSosModal
                alertData={socketData.activeSosAlert}
                onDismiss={() => socketData.setActiveSosAlert(null)}
            />
        );
    }

    // 2. For Providers/Sewaks: Only show alarms on their dashboard routes
    if (!path.startsWith('/provider') && !path.startsWith('/sewak')) {
        return null;
    }

    const {
        incomingRequest, setIncomingRequest,
        incomingLeadRequest, setIncomingLeadRequest,
        scheduleAcceptedData, setScheduleAcceptedData,
        reminderData, setReminderData
    } = socketData;

    if (reminderData) {
        return (
            <BookingReminderModal
                data={reminderData}
                onDismiss={() => setReminderData(null)}
            />
        );
    }

    if (scheduleAcceptedData) {
        return (
            <ScheduleAcceptedModal
                data={scheduleAcceptedData}
                onDismiss={() => setScheduleAcceptedData(null)}
            />
        );
    }

    if (incomingLeadRequest) {
        return (
            <IncomingLeadModal
                request={incomingLeadRequest}
                onAction={() => setIncomingLeadRequest(null)}
            />
        );
    }

    if (!incomingRequest) return null;

    return (
        <IncomingRequestModal
            request={incomingRequest}
            onAction={(result, info) => {
                setIncomingRequest(null);
                // Accepted: open that booking's chat — in the bookings list if
                // it is on screen, else on the Bookings page.
                if (result === 'accepted' && info?.openChat && info.bookingId) {
                    const detail = { bookingId: info.bookingId, handled: false };
                    window.dispatchEvent(new CustomEvent('OPEN_BOOKING_CHAT', { detail }));
                    if (!detail.handled) navigate(`/provider/bookings?chat=${info.bookingId}`);
                }
                // Closing the popup is not enough: the dashboard list is a
                // separate component that only refetches on a socket event,
                // so a booking accepted here kept showing Accept/Reject —
                // one stray tap away from cancelling a job just taken.
                window.dispatchEvent(new CustomEvent('BOOKING_ACTION_TAKEN'));
            }}
        />
    );
};

export default GlobalAlarm;
