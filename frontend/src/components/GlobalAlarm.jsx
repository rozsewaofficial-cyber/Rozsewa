import React from 'react';
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
            onAction={() => setIncomingRequest(null)}
        />
    );
};

export default GlobalAlarm;
