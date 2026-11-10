'use strict';
const c = require('./ctx');
const { P, table, s, uniq, short, countBy, empty, animals } = c;

P('## 8. Transfers, sales, purchases, waitlist, enclosures');
P();
const cnt = (f) => animals.filter(a => !empty(a[f])).length;
const first = (fn) => animals.find(fn);
const ownerDiff = animals.filter(a => a.originalCreatorId && s(a.originalCreatorId) !== s(a.creatorId));
const sold = first(a => a.salePrice > 0 && a.saleDate);
table(['Evidence', 'Count', 'Notes / example'], [
    ['animals.originalCreatorId != creatorId (animal changed hands)', ownerDiff.length, ownerDiff[0] ? `${ownerDiff[0].id_public}: ${ownerDiff[0].originalCreatorId} -> ${ownerDiff[0].creatorId}` : ''],
    ['animals with ownershipHistory (entries)', `${cnt('ownershipHistory')} (${animals.reduce((n, a) => n + (a.ownershipHistory || []).length, 0)})`, short((first(a => (a.ownershipHistory || []).length) || {}).ownershipHistory, 200)],
    ['animals with keeperHistory (entries)', `${cnt('keeperHistory')} (${animals.reduce((n, a) => n + (a.keeperHistory || []).length, 0)})`, short((first(a => (a.keeperHistory || []).length) || {}).keeperHistory, 200)],
    ['animals.transferHistory (free text)', cnt('transferHistory'), short((first(a => a.transferHistory) || {}).transferHistory, 150)],
    ['animals.pendingTransferId (-> animaltransfers)', cnt('pendingTransferId'), uniq(animals.map(a => a.pendingTransferId).filter(Boolean)).join(', ')],
    ['animals.breederId_public != creatorId_public', animals.filter(a => a.breederId_public && a.creatorId_public && a.breederId_public !== a.creatorId_public).length, ''],
    ['animals.saleTransactionId (-> transactions): set / unique', `${cnt('saleTransactionId')} / ${uniq(animals.map(a => a.saleTransactionId).filter(Boolean)).length}`, short((first(a => a.saleTransactionId) || {}).saleTransactionId)],
    ['animals.purchaseTransactionId: set / unique', `${cnt('purchaseTransactionId')} / ${uniq(animals.map(a => a.purchaseTransactionId).filter(Boolean)).length}`, short((first(a => a.purchaseTransactionId) || {}).purchaseTransactionId)],
    ['animals.soldStatus values', cnt('soldStatus'), JSON.stringify(countBy(animals.map(a => a.soldStatus).filter(Boolean)))],
    ['animals with salePrice>0 AND saleDate (sale rebuildable)', animals.filter(a => a.salePrice > 0 && a.saleDate).length, sold ? short({ id: sold.id_public, price: sold.salePrice, date: sold.saleDate, buyer: sold.buyerName }) : ''],
    ['animals with buyerName', cnt('buyerName'), ''],
    ['animals with purchasePrice>0 (purchase rebuildable)', animals.filter(a => a.purchasePrice > 0).length, ''],
    ['animals with reserved* data (-> waitlistentries)', animals.filter(a => a.reservedBuyerName || a.reservedWaitlistEntryId || a.reservedPrice).length, ''],
    ['animals.reservedWaitlistEntryId: set / unique', `${cnt('reservedWaitlistEntryId')} / ${uniq(animals.map(a => a.reservedWaitlistEntryId).filter(Boolean)).length}`, short((first(a => a.reservedWaitlistEntryId) || {}).reservedWaitlistEntryId)],
    ['animals.enclosureId (-> enclosures): set / unique', `${cnt('enclosureId')} / ${uniq(animals.map(a => a.enclosureId).filter(Boolean)).length}`, short((first(a => a.enclosureId) || {}).enclosureId)],
    ['animals.colonyId: set / unique', `${cnt('colonyId')} / ${uniq(animals.map(a => a.colonyId).filter(Boolean)).length}`, short(uniq(animals.map(a => a.colonyId).filter(Boolean)).slice(0, 5))],
    ['animals.sbId (SimpleBreed import ids)', cnt('sbId'), short((first(a => a.sbId) || {}).sbId)],
]);
P(`- Transaction ids resolve to a restored record: **0** (collection not backed up). ${cnt('saleTransactionId')} sale and ${cnt('purchaseTransactionId')} purchase ObjectIds are known exactly, with price/date/buyer duplicated on the animal: a PARTIAL rebuild (type, animalId, animalName, price, date, buyer/seller, userId=creatorId, same _id). NOT recoverable: receipts, attachments, payments, expense/income entries, gifts, any transaction not tied to an animal.`);
P('- Enclosures: enclosure ids are known (exact _id) but names, dimensions, supplies and logs lived only in the missing collections; only animal-side fields (housingType, bedding, humidity, temperatureRange, lighting, enrichment) remain.');
P();
