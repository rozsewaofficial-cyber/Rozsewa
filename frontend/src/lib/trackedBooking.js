// Which of the customer's bookings the Live Tracking screen should show.
//
// It used to fall back to ANY completed booking without a rating, however old,
// ahead of the booking the customer had just cancelled — so cancelling a
// booking opened the "Service Completed" bill of some old job instead.
//
// Order:
//   1. a booking still in progress (pending .. started), newest first;
//   2. the booking already on screen, whatever happened to it — a cancel shows
//      as cancelled, a completion goes to that booking's own bill;
//   3. otherwise the most recent of: a booking cancelled in the last 15
//      minutes (not dismissed), or one completed (and not yet rated) in the
//      last hour. Older finished bookings live in Service History.

export const ACTIVE_STATUSES = ["pending", "confirmed", "on_the_way", "started"];
export const RECENT_CANCEL_MINUTES = 15;
export const RECENT_COMPLETION_MINUTES = 60;

const lastChange = (b) => new Date(b.completedAt || b.updatedAt || b.createdAt || 0).getTime();
const minutesAgo = (b, now) => (now - lastChange(b)) / 60000;

export const pickTrackedBooking = (bookings, { trackedId = null, dismissed = [], now = Date.now() } = {}) => {
  const list = Array.isArray(bookings) ? bookings : [];

  const inProgress = list.find((b) => ACTIVE_STATUSES.includes(b.status));
  if (inProgress) return inProgress;

  if (trackedId) {
    const tracked = list.find((b) => b._id === trackedId);
    if (tracked) return tracked;
  }

  const recent = list.filter((b) => {
    if (b.status === "cancelled") {
      return !dismissed.includes(b._id) && minutesAgo(b, now) <= RECENT_CANCEL_MINUTES;
    }
    if (b.status === "completed") {
      return (!b.rating || b.rating === 0) && minutesAgo(b, now) <= RECENT_COMPLETION_MINUTES;
    }
    return false;
  });
  if (recent.length === 0) return null;
  return recent.reduce((a, b) => (lastChange(b) > lastChange(a) ? b : a));
};
