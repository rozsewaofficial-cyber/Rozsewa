import React from 'react';
import { useSocket } from '@/context/SocketContext';
import IncomingRequestModal from '@/modules/provider/components/IncomingRequestModal';
import ScheduleAcceptedModal from '@/modules/provider/components/ScheduleAcceptedModal';
import BookingReminderModal from '@/modules/provider/components/BookingReminderModal';

const GlobalAlarm = () => {
    const socketData = useSocket();
    
    // Safety fallback for Vite HMR issues where context might be temporarily lost
    if (!socketData) return null;

    const { 
        incomingRequest, setIncomingRequest, 
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

    if (!incomingRequest) return null;

    return (
        <IncomingRequestModal
            request={incomingRequest}
            onAction={() => setIncomingRequest(null)}
        />
    );
};

export default GlobalAlarm;
