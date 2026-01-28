# Empty Fields Consolidation

This directory contains utilities for consolidating empty database fields to use consistent `null` values.

## What This Does

The system uses two mechanisms to ensure all empty fields are standardized to `null`:

1. **One-time Migration Script** (`consolidate-empty-fields.js`)
   - Scans entire database for inconsistent empty values (empty strings, undefined, missing fields)
   - Converts everything to consistent `null` values
   - Creates a summary report of how many documents were updated

2. **Auto-normalization Middleware**
   - Added to all main Mongoose schemas (User, Animal, Litter, GeneticsData, Species, SpeciesConfig)
   - Automatically normalizes empty values on save
   - Prevents new inconsistencies from being created

## Running the Migration

The migration script should only need to run once to clean up existing data.

```bash
# Navigate to the backend directory
cd crittertrack-pedigree

# Run the migration script
node scripts/consolidate-empty-fields.js
```

### What to expect:
- The script will connect to MongoDB
- Process all documents in: Animals, GeneticsData, Species, SpeciesConfig, and Users
- Show progress every 100 documents for large collections
- Print a summary of how many documents were updated
- Display total time to completion

### Example output:
```
Connected to MongoDB

🔄 Processing Animals...
✓ Animals: 245 documents updated

🔄 Processing GeneticsData...
  ✓ Updated 10 genetics documents...
✓ GeneticsData: 34 documents updated

✓ Species: 0 documents updated
✓ SpeciesConfig: 2 documents updated
✓ Users: 1 documents updated

✅ Consolidation complete!
Summary: { animals: 245, genetics: 34, species: 0, speciesConfig: 2, users: 1 }

All empty strings and undefined values have been converted to null
```

## How It Works

### Before Consolidation (Inconsistent)
```javascript
{
  _id: "123",
  name: "Fluffy",
  bio: "",           // Empty string
  profileImage: null, // Null
  website: undefined  // Undefined (missing field)
}
```

### After Consolidation (Consistent)
```javascript
{
  _id: "123",
  name: "Fluffy",
  bio: null,         // Standardized to null
  profileImage: null,
  // website field omitted or set to null
}
```

## Going Forward

All new saves will automatically normalize empty values thanks to the middleware in the schemas. No additional action needed.
