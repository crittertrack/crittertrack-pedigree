const webpush = require('web-push');

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:crittertrackowner@gmail.com';

let vapidConfigured = false;
if (vapidPublicKey && vapidPrivateKey) {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    vapidConfigured = true;
} else {
    console.warn('[push] VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY not set — push notifications are disabled.');
}

// Maps every Notification.type enum value to a user-facing preference category.
// Any type not listed here falls back to the 'other' category.
const TYPE_TO_CATEGORY = {
    breeder_request: 'requests',
    parent_request: 'requests',
    link_request: 'requests',
    transfer_request: 'requests',
    transfer_accepted: 'requests',
    transfer_declined: 'requests',
    transfer_cancelled: 'requests',
    animal_returned: 'requests',
    animal_recalled: 'requests',
    // Moderation, admin broadcasts/announcements, and report/bug-report replies are all
    // platform/admin-driven communication (as opposed to another user or your own animals),
    // so they're grouped under one "system" preference category.
    moderator_warning: 'system',
    moderator_message: 'system',
    account_suspended: 'system',
    account_banned: 'system',
    content_edited: 'system',
    broadcast: 'system',
    announcement: 'system',
    bug_report_update: 'system',
    report_status_update: 'system',
    report_feedback: 'system',
    new_rating: 'system',
    litter_assignment: 'breeding',
};

// Category metadata shown in Settings so users can toggle each on/off.
const PUSH_CATEGORIES = [
    { id: 'messages', label: 'New messages' },
    { id: 'requests', label: 'Requests & transfers', description: 'Breeder/parent/link requests, animal transfers' },
    { id: 'system', label: 'System notifications', description: 'Moderation notices, announcements/broadcasts, new ratings, and updates on your bug reports/issues' },
    { id: 'breeding', label: 'Litters & mating reminders' },
    { id: 'feeding', label: 'Feeding reminders', description: 'Daily digest of animals overdue for feeding' },
    { id: 'enclosureCare', label: 'Enclosure & supplies', description: 'Daily digest of overdue enclosure cleaning/maintenance and supply reorders' },
    { id: 'careTasks', label: 'Grooming, training & custom care', description: 'Daily digest of overdue grooming/training schedules and custom animal care tasks' },
    { id: 'health', label: 'Health & medical alerts', description: 'Daily digest of due medication doses, quarantine end dates, and Concern/Critical health status' },
];

const categoryForType = (type) => TYPE_TO_CATEGORY[type] || 'other';

const isCategoryEnabled = (user, category) => {
    if (!user.pushCategoryPreferences) return true;
    const value = user.pushCategoryPreferences.get
        ? user.pushCategoryPreferences.get(category)
        : user.pushCategoryPreferences[category];
    return value !== false; // missing/undefined => enabled by default
};

/**
 * Sends a payload to every subscription the user has, pruning any that the
 * push service reports as gone (404/410).
 */
const sendPushToUser = async (userOrId, payload, category = 'other') => {
    if (!vapidConfigured) return;

    const { User } = require('../database/models');
    // Accept either a raw id (string/ObjectId) or an already-loaded user doc that includes pushSubscriptions
    const user = Array.isArray(userOrId?.pushSubscriptions)
        ? userOrId
        : await User.findById(userOrId).select('pushSubscriptions pushCategoryPreferences');

    if (!user || !Array.isArray(user.pushSubscriptions) || user.pushSubscriptions.length === 0) return;
    if (!isCategoryEnabled(user, category)) return;

    const body = JSON.stringify(payload);
    const staleEndpoints = [];

    await Promise.all(user.pushSubscriptions.map(async (sub) => {
        try {
            await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, body);
        } catch (err) {
            if (err.statusCode === 404 || err.statusCode === 410) {
                staleEndpoints.push(sub.endpoint);
            } else {
                console.error('[push] Send failed for', sub.endpoint, err.statusCode || err.message);
            }
        }
    }));

    if (staleEndpoints.length > 0) {
        await User.updateOne(
            { _id: user._id },
            { $pull: { pushSubscriptions: { endpoint: { $in: staleEndpoints } } } }
        );
    }
};

/**
 * Builds and sends a push payload for a just-created Notification document.
 */
const sendPushForNotification = async (doc) => {
    const category = categoryForType(doc.type);
    const title = doc.title || 'CritterTrack';
    const body = doc.message || 'You have a new notification.';
    await sendPushToUser(doc.userId, { title, body, url: '/notifications', tag: doc._id.toString() }, category);
};

module.exports = {
    sendPushToUser,
    sendPushForNotification,
    categoryForType,
    isCategoryEnabled,
    PUSH_CATEGORIES,
    vapidPublicKey,
};
