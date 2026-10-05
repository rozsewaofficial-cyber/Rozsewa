// Chat with the partner opens only once they have accepted the booking, and
// closes when the job is over. A booking made to a specific shop already has a
// provider while it is still pending, so "has a provider" is not enough.
// Mirrors CHAT_OPEN_STATUSES in backend/controllers/chatController.js.
export const CHAT_OPEN_STATUSES = ["confirmed", "on_the_way", "started"];

export const canChatOnBooking = (status) => CHAT_OPEN_STATUSES.includes(status);
