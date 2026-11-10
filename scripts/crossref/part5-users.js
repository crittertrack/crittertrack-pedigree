'use strict';
const c = require('./ctx');
const { P, table, uniq, short, countBy, empty, users, animals } = c;

P('## 9. Users and profiles: settings, notifications, contacts, messaging');
P();
const uc = (f) => users.filter(u => !empty(u[f])).length;
const uf = (f) => short((users.find(u => !empty(u[f])) || {})[f], 100);
table(['users field', 'Users with data', 'Relevance', 'Example'], [
    ['uiPreferences', uc('uiPreferences'), 'settings retained', uf('uiPreferences')],
    ['pushCategoryPreferences', uc('pushCategoryPreferences'), 'notification settings retained', uf('pushCategoryPreferences')],
    ['pushSubscriptions', uc('pushSubscriptions'), 'browser push endpoints (may be stale)', ''],
    ['deviceTokens', uc('deviceTokens'), 'mobile push tokens', ''],
    ['emailNotificationPreference', uc('emailNotificationPreference'), 'email prefs', short(countBy(users.map(u => u.emailNotificationPreference)), 100)],
    ['blockedUsers', uc('blockedUsers'), 'messaging settings only; no Message ids referenced', ''],
    ['warnings', uc('warnings'), 'moderation echo (auditlogs/reports missing)', uf('warnings')],
    ['animalCollections / breedingLineDefs / dismissedDuplicatePairs', `${uc('animalCollections')} / ${uc('breedingLineDefs')} / ${uc('dismissedDuplicatePairs')}`, 'retained', ''],
    ['monthlyDonationActive', users.filter(u => u.monthlyDonationActive).length, 'Ko-fi hint (kofipledges missing)', ''],
    ['role (non-user)', users.filter(u => u.role && u.role !== 'user').length, 'admin/moderator roles', short(countBy(users.map(u => u.role)), 100)],
    ['two_factor_enabled', users.filter(u => u.two_factor_enabled).length, '2FA secrets are in a separate model and NOT in backup', ''],
    ['recoveryEmailVerified', users.filter(u => u.recoveryEmailVerified).length, 'recovery email', ''],
    ['password', users.filter(u => u.password).length, 'hashes not in backup', ''],
]);
const hintKeys = uniq([...users.flatMap(u => Object.keys(u)), ...animals.flatMap(a => Object.keys(a))].filter(k => /contact|notif|message|report|favorite|rating|waitlist/i.test(k)));
P(`- Fields whose names hint at other collections: ${hintKeys.map(k => '`' + k + '`').join(', ')}`);
P('- No ids of Notification / Message / Report / Favorite / BreederRating / contact documents are referenced from any backed-up field. `animals.buyerContact/sellerContact` are free text on the animal, not contact records.');
P();
