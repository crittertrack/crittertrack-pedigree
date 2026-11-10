'use strict';
/**
 * transactions: only those whose _id is referenced by an animal (saleTransactionId / purchaseTransactionId)
 * AND for which the animal carries a date (Transaction.date is required). No amounts or dates are invented;
 * records lacking a date are reported and skipped. Currency has no field in the schema, so it goes in notes.
 */
module.exports = async (L, ctx) => {
    const { Transaction } = L.models;
    const docs = [], skipped = [];
    for (const a of ctx.animals) {
        const base = { userId: L.oid(a.creatorId), animalId: a.id_public, animalName: a.name || null, litterId: null, category: null, description: null, receiptNumber: null, receiptIssuedAt: null, attachments: [], payments: [], buyerUserId: null, sellerUserId: null, __v: 0 };
        if (a.saleTransactionId) {
            if (a.saleDate && a.salePrice != null) docs.push({ ...base, _id: L.oid(a.saleTransactionId), type: 'sale', price: Number(a.salePrice) || 0, date: new Date(a.saleDate), buyer: a.buyerName || null, seller: null,
                notes: `Reconstructed from backup (${a.saleRecordCurrency || 'currency unknown'}).`, createdAt: new Date(a.saleDate), updatedAt: new Date() });
            else skipped.push(`${a.id_public} sale ${a.saleTransactionId} (no sale date/price on animal)`);
        }
        if (a.purchaseTransactionId) {
            if (a.purchaseDate && a.purchasePrice != null) docs.push({ ...base, _id: L.oid(a.purchaseTransactionId), type: 'purchase', price: Number(a.purchasePrice) || 0, date: new Date(a.purchaseDate), buyer: null, seller: a.sellerName || null,
                notes: `Reconstructed from backup (${a.purchasePriceCurrency || 'currency unknown'}).`, createdAt: new Date(a.purchaseDate), updatedAt: new Date() });
            else skipped.push(`${a.id_public} purchase ${a.purchaseTransactionId} (no purchase date/price on animal)`);
        }
    }
    L.log(`  transactions rebuildable: ${docs.length}; not rebuildable: ${skipped.length}`);
    skipped.forEach(s => L.log('    skipped: ' + s));
    await L.insertMissing(Transaction, docs, (d) => ({ _id: d._id }), 'transactions');
};
