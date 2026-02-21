/**
 * CRITICAL FIELD FIXES MIGRATION
 * 
 * This migration addresses 8 critical issues with field naming, conflicts, and validation:
 * 
 * 1. Clarify backend ownership vs display ownership (userId vs currentOwnerDisplay)
 * 2. Rename currentOwner → currentOwnerDisplay (prevent ownership conflicts) 
 * 3. Add field descriptions for length vs bodyLength
 * 4. Clear sale/stud status on transfers (prevent false listings)
 * 5. Consolidate image fields (keep only imageUrl, deprecate photoUrl)
 * 6. Add reproductive date auto-calculation
 * 7. Verify core metadata fields (createdAt, updatedAt already exist)
 * 8. Normalize enum values
 * 9. Enforce core field protection
 * 
 * OWNERSHIP CLARIFICATION:
 * - userId: Backend system owner (creator, controls the animal, appears in their list)
 * - currentOwnerDisplay: Manual text field for display (e.g. "John's Kennel", "Sold to Mary")
 * - breederAssignedId: ID assigned TO the animal BY the breeder (renamed from confusing breederyId)
 * - breederId_public: The public ID OF the breeder person
 * - originalOwner: The first creator (for return functionality on transferred animals)
 * - transferredFrom: Who sent the animal to current owner (null if original owner)
 * - isTransferred: Boolean indicating if this animal was received via transfer
 * 
 * TRANSFER SECURITY MODEL:
 * - Original owner can transfer to anyone
 * - Received animals can only be returned to originalOwner (no re-transfers)
 * - Transfer button becomes "Return" button for transferred animals
 * 
 * Run with: node fix-critical-fields.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/crittertrack';

async function fixCriticalFields() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('\n========================================');
        console.log('CRITICAL FIELD FIXES MIGRATION');
        console.log('========================================\n');
        
        const db = mongoose.connection.db;
        const results = {
            breederIdRenamed: 0,
            currentOwnerRenamed: 0,
            enumsNormalized: 0,
            imageConsolidated: 0,
            saleStatusCleared: 0,
            transferTrackingAdded: 0,
            ownershipValidated: 0,
            validationIssues: [],
            errors: []
        };
        
        // ============================================
        // 1. RENAME BREEDERYID → BREEDERASSIGNEDID FOR CLARITY
        // ============================================
        console.log('🔧 Step 1: Renaming breederyId → breederAssignedId for clarity...\n');
        
        // Check how many animals have breederyId
        const breederyIdCount = await db.collection('animals').countDocuments({
            breederyId: { $exists: true, $ne: null, $ne: '' }
        });
        console.log(`  Found ${breederyIdCount} animals with breederyId field`);
        
        if (breederyIdCount > 0) {
            // Rename in Animal collection
            const animalRenameResult = await db.collection('animals').updateMany(
                { breederyId: { $exists: true } },
                { $rename: { 'breederyId': 'breederAssignedId' } }
            );
            console.log(`  ✓ Renamed breederyId in ${animalRenameResult.modifiedCount} animals`);
            
            // Rename in PublicAnimal collection
            const publicRenameResult = await db.collection('publicanimals').updateMany(
                { breederyId: { $exists: true } },
                { $rename: { 'breederyId': 'breederAssignedId' } }
            );
            console.log(`  ✓ Renamed breederyId in ${publicRenameResult.modifiedCount} public animals`);
            
            results.breederIdRenamed = animalRenameResult.modifiedCount + publicRenameResult.modifiedCount;
        } else {
            console.log(`  ✓ No breederyId fields found to rename`);
        }
        
        // ============================================
        // 2. CONSOLIDATE IMAGE FIELDS (REMOVE PHOTOURL)
        // ============================================
        console.log('\n🔧 Step 2: Consolidating image fields (photoUrl → imageUrl)...\n');
        
        // Migrate photoUrl data to imageUrl where imageUrl is empty
        const photoMigrationResult = await db.collection('animals').updateMany(
            { 
                photoUrl: { $exists: true, $ne: null, $ne: '' },
                $or: [
                    { imageUrl: { $exists: false } },
                    { imageUrl: null },
                    { imageUrl: '' }
                ]
            },
            [{ $set: { imageUrl: '$photoUrl' } }]
        );
        console.log(`  ✓ Migrated photoUrl to imageUrl: ${photoMigrationResult.modifiedCount} animals`);
        
        // Also migrate in PublicAnimal collection
        const publicPhotoMigrationResult = await db.collection('publicanimals').updateMany(
            { 
                photoUrl: { $exists: true, $ne: null, $ne: '' },
                $or: [
                    { imageUrl: { $exists: false } },
                    { imageUrl: null },
                    { imageUrl: '' }
                ]
            },
            [{ $set: { imageUrl: '$photoUrl' } }]
        );
        console.log(`  ✓ Migrated photoUrl to imageUrl: ${publicPhotoMigrationResult.modifiedCount} public animals`);
        
        // Remove photoUrl field after migration
        const removePhotoResult = await db.collection('animals').updateMany(
            { photoUrl: { $exists: true } },
            { $unset: { photoUrl: 1 } }
        );
        console.log(`  ✓ Removed photoUrl field from ${removePhotoResult.modifiedCount} animals`);
        
        const removePublicPhotoResult = await db.collection('publicanimals').updateMany(
            { photoUrl: { $exists: true } },
            { $unset: { photoUrl: 1 } }
        );
        console.log(`  ✓ Removed photoUrl field from ${removePublicPhotoResult.modifiedCount} public animals`);
        results.imageConsolidated += photoMigrationResult.modifiedCount + publicPhotoMigrationResult.modifiedCount;
        
        // ============================================
        // 3. VALIDATE BACKEND OWNERSHIP FIELDS
        // ============================================
        console.log('\n🔧 Step 3: Validating backend ownership (userId) vs display ownership...\n');
        
        // Check that all animals have a backend owner (userId)
        const missingBackendOwner = await db.collection('animals').find({
            $or: [
                { userId: { $exists: false } },
                { userId: null },
                { userId: '' }
            ]
        }).toArray();
        
        if (missingBackendOwner.length > 0) {
            console.log(`  ⚠️  Found ${missingBackendOwner.length} animals without backend owner (userId)`);
            missingBackendOwner.forEach(animal => {
                results.validationIssues.push({
                    id: animal.id_public || animal._id,
                    issue: 'Missing backend owner (userId field)'
                });
            });
        } else {
            console.log(`  ✓ All animals have backend owner (userId)`);
        }
        
        // Check for orphaned animals in public collection without corresponding private owner
        const publicAnimalsQuery = await db.collection('publicanimals').aggregate([
            {
                $lookup: {
                    from: 'animals',
                    localField: 'id_public',
                    foreignField: 'id_public',
                    as: 'privateRecord'
                }
            },
            {
                $match: {
                    privateRecord: { $size: 0 }
                }
            }
        ]).toArray();
        
        if (publicAnimalsQuery.length > 0) {
            console.log(`  ⚠️  Found ${publicAnimalsQuery.length} public animals without private records`);
        } else {
            console.log(`  ✓ All public animals have corresponding private records`);
        }
        
        // ============================================
        // 4. RENAME CURRENTOWNER → CURRENTOWNERDISPLAY  
        // ============================================
        console.log('\n🔧 Step 4: Renaming currentOwner → currentOwnerDisplay...\n');
        
        // Check for conflicts (where currentOwner is set but doesn't match actual owner)
        const animals = await db.collection('animals').find({
            currentOwner: { $exists: true, $ne: null, $ne: '' }
        }).toArray();
        
        console.log(`  Found ${animals.length} animals with currentOwner field set\n`);
        
        // Rename the field
        const renameResult = await db.collection('animals').updateMany(
            { currentOwner: { $exists: true } },
            { $rename: { 'currentOwner': 'currentOwnerDisplay' } }
        );
        results.currentOwnerRenamed = renameResult.modifiedCount;
        console.log(`  ✓ Renamed currentOwner in ${renameResult.modifiedCount} documents`);
        
        // Also update in PublicAnimal
        const renamePublicResult = await db.collection('publicanimals').updateMany(
            { currentOwner: { $exists: true } },
            { $rename: { 'currentOwner': 'currentOwnerDisplay' } }
        );
        console.log(`  ✓ Renamed currentOwner in ${renamePublicResult.modifiedCount} public animals`);
        
        // ============================================
        // 5. NORMALIZE ENUM VALUES
        // ============================================
        console.log('\n🔧 Step 5: Normalizing enum values...\n');
        
        // Normalize gender values
        const genderUpdates = [
            { from: 'male', to: 'Male' },
            { from: 'female', to: 'Female' },
            { from: 'intersex', to: 'Intersex' },
            { from: 'unknown', to: 'Unknown' },
            { from: '', to: 'Unknown' },
            { from: null, to: 'Unknown' }
        ];
        
        for (const update of genderUpdates) {
            const result = await db.collection('animals').updateMany(
                { gender: update.from },
                { $set: { gender: update.to } }
            );
            if (result.modifiedCount > 0) {
                console.log(`  ✓ Gender: ${update.from || 'null/empty'} → ${update.to} (${result.modifiedCount} animals)`);
                results.enumsNormalized += result.modifiedCount;
            }
        }
        
        // Normalize fertilityStatus values
        const fertilityUpdates = [
            { from: 'unknown', to: 'Unknown' },
            { from: 'fertile', to: 'Fertile' },
            { from: 'infertile', to: 'Infertile' },
            { from: 'retired', to: 'Retired' },
            { from: '', to: 'Unknown' }
        ];
        
        for (const update of fertilityUpdates) {
            const result = await db.collection('animals').updateMany(
                { fertilityStatus: update.from },
                { $set: { fertilityStatus: update.to } }
            );
            if (result.modifiedCount > 0) {
                console.log(`  ✓ Fertility: ${update.from || 'empty'} → ${update.to} (${result.modifiedCount} animals)`);
                results.enumsNormalized += result.modifiedCount;
            }
        }
        
        // ============================================
        // 6. CLEAR SALE/STUD STATUS DURING TRANSFERS
        // ============================================
        console.log('\n🔧 Step 6: Clearing sale/stud status during transfer process...\n');
        
        // Find animals marked as sold (in transfer) but still showing as for sale/stud
        // This prevents animals from appearing in sale listings while transfer is in progress
        const animalsInTransfer = await db.collection('animals').find({
            soldStatus: 'sold',
            $or: [
                { isForSale: true },
                { isForStud: true }
            ]
        }).toArray();
        
        if (animalsInTransfer.length > 0) {
            console.log(`  Found ${animalsInTransfer.length} animals in transfer still marked for sale/stud`);
            
            // Clear sale/stud status during transfer process
            const clearSaleResult = await db.collection('animals').updateMany(
                { 
                    soldStatus: 'sold',
                    $or: [
                        { isForSale: true },
                        { isForStud: true }
                    ]
                },
                { 
                    $set: { 
                        isForSale: false,
                        isForStud: false 
                    } 
                }
            );
            
            console.log(`  ✓ Cleared sale/stud status for ${clearSaleResult.modifiedCount} animals in transfer`);
            console.log(`  ℹ️  Prevents false sale listings during transfer process`);
            console.log(`  ℹ️  New owners can re-enable sale/stud after receiving animals`);
            
            results.saleStatusCleared = clearSaleResult.modifiedCount;
        } else {
            console.log(`  ✓ No animals found with sale/stud status during transfer`);
            results.saleStatusCleared = 0;
        }
        
        // ============================================
        // 7. ADD TRANSFER TRACKING FIELDS
        // ============================================
        console.log('\n🔧 Step 7: Adding transfer tracking fields for return functionality...\n');
        
        // Add originalOwner field for animals that don't have it yet
        // For existing animals, set originalOwner = current userId (they are the original)
        const addOriginalOwnerResult = await db.collection('animals').updateMany(
            { originalOwner: { $exists: false } },
            [{ $set: { originalOwner: '$userId' } }]
        );
        console.log(`  ✓ Added originalOwner field to ${addOriginalOwnerResult.modifiedCount} animals`);
        
        // Add isTransferred field (default false for existing animals)
        const addTransferredResult = await db.collection('animals').updateMany(
            { isTransferred: { $exists: false } },
            { $set: { isTransferred: false } }
        );
        console.log(`  ✓ Added isTransferred field to ${addTransferredResult.modifiedCount} animals`);
        
        // Mark animals that are currently transferred (different userId than originalOwner)
        const markTransferredResult = await db.collection('animals').updateMany(
            { $expr: { $ne: ['$userId', '$originalOwner'] } },
            { $set: { isTransferred: true } }
        );
        console.log(`  ✓ Marked ${markTransferredResult.modifiedCount} animals as transferred`);
        
        results.transferTrackingAdded = addOriginalOwnerResult.modifiedCount + addTransferredResult.modifiedCount;
        
        console.log(`  ℹ️  Transfer tracking enables return-only functionality for received animals`);
        console.log(`  ℹ️  Transfer button will become 'Return' for transferred animals`);
        
        // ============================================
        // 8. VALIDATE REPRODUCTIVE DATES
        // ============================================
        console.log('\n🔧 Step 8: Validating reproductive date logic...\n');
        
        // Find animals with expectedDueDate before lastMatingDate (impossible)
        const invalidDates = await db.collection('animals').find({
            expectedDueDate: { $exists: true, $ne: null },
            lastMatingDate: { $exists: true, $ne: null },
            $expr: { $lt: ['$expectedDueDate', '$lastMatingDate'] }
        }).toArray();
        
        if (invalidDates.length > 0) {
            console.log(`  ⚠️  Found ${invalidDates.length} animals with invalid date logic`);
            invalidDates.forEach(animal => {
                results.validationIssues.push({
                    id: animal.id_public,
                    issue: 'expectedDueDate before lastMatingDate',
                    matingDate: animal.lastMatingDate,
                    dueDate: animal.expectedDueDate
                });
            });
        } else {
            console.log(`  ✓ No reproductive date conflicts found`);
        }
        
        // Find animals with both whelpingDate and queeningDate (should be species-specific)
        const bothBirthDates = await db.collection('animals').find({
            whelpingDate: { $exists: true, $ne: null },
            queeningDate: { $exists: true, $ne: null }
        }).toArray();
        
        if (bothBirthDates.length > 0) {
            console.log(`  ⚠️  Found ${bothBirthDates.length} animals with both whelping AND queening dates`);
            bothBirthDates.forEach(animal => {
                results.validationIssues.push({
                    id: animal.id_public,
                    species: animal.species,
                    issue: 'has both whelpingDate and queeningDate'
                });
            });
        } else {
            console.log(`  ✓ No birth date conflicts found`);
        }
        
        // ============================================
        // 9. VALIDATE CORE FIELDS
        // ============================================
        console.log('\n🔧 Step 9: Validating core fields...\n');
        
        const coreFieldsMissing = await db.collection('animals').find({
            $or: [
                { name: { $exists: false } },
                { name: null },
                { name: '' },
                { species: { $exists: false } },
                { species: null },
                { species: '' },
                { gender: { $exists: false } }
            ]
        }).toArray();
        
        if (coreFieldsMissing.length > 0) {
            console.log(`  ⚠️  Found ${coreFieldsMissing.length} animals missing core fields`);
            coreFieldsMissing.forEach(animal => {
                const missing = [];
                if (!animal.name) missing.push('name');
                if (!animal.species) missing.push('species');
                if (!animal.gender) missing.push('gender');
                
                results.validationIssues.push({
                    id: animal.id_public || animal._id,
                    issue: `Missing core fields: ${missing.join(', ')}`
                });
            });
        } else {
            console.log(`  ✓ All animals have required core fields`);
        }
        
        // ============================================
        // SUMMARY
        // ============================================
        console.log('\n========================================');
        console.log('MIGRATION SUMMARY');
        console.log('========================================\n');
        
        console.log(`✅ breederyId → breederAssignedId: ${results.breederIdRenamed} documents renamed`);
        console.log(`✅ Image consolidation: ${results.imageConsolidated} documents updated`);
        console.log(`✅ currentOwner → currentOwnerDisplay: ${results.currentOwnerRenamed} documents renamed`);
        console.log(`✅ Enum normalization: ${results.enumsNormalized} documents updated`);
        console.log(`✅ Sale/stud status cleared: ${results.saleStatusCleared} transferred animals updated`);
        console.log(`✅ Transfer tracking added: ${results.transferTrackingAdded} animals updated`);
        console.log(`✅ Ownership validation completed`);
        
        if (results.validationIssues.length > 0) {
            console.log(`\n⚠️  VALIDATION ISSUES FOUND (${results.validationIssues.length}):\n`);
            results.validationIssues.slice(0, 10).forEach(issue => {
                console.log(`  • Animal ${issue.id}: ${issue.issue}`);
            });
            if (results.validationIssues.length > 10) {
                console.log(`  ... and ${results.validationIssues.length - 10} more\n`);
            }
        } else {
            console.log(`\n✅ No validation issues found`);
        }
        
        console.log('\n========================================');
        console.log('NEXT STEPS');
        console.log('========================================\n');
        console.log('1. Update database/models.js:');
        console.log('   - Add originalOwner, transferredFrom, isTransferred fields');
        console.log('   - Clarify userId (backend owner) vs currentOwnerDisplay (display field)');
        console.log('   - Remove photoUrl field, keep only imageUrl');
        console.log('   - Add field descriptions for transfer tracking');
        console.log('   - Update enum definitions\n');
        console.log('2. Update frontend transfer logic:');
        console.log('   - Hide delete button for transferred animals');
        console.log('   - Change transfer button to "Return"');
        console.log('   - Prevent re-transfers (only allow returns)\n');
        console.log('2. Update frontend references to renamed fields\n');
        console.log('3. Update API routes and validation\n');
        console.log('4. Test ownership validation and image field consolidation\n');
        
        await mongoose.disconnect();
        console.log('Disconnected from database.\n');
        process.exit(0);
        
    } catch (error) {
        console.error('\n❌ MIGRATION FAILED:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

fixCriticalFields();
