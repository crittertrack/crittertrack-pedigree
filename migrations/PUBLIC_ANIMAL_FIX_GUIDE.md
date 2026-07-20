# Public Animal Visibility Fix - User Guide

## Problem Summary

Some animals are showing as **private** when they should be **public**, particularly in pedigree and relationship views. This happens when the following fields get out of sync:

- `isDisplay` (frontend toggle, what users see)
- `showOnPublicProfile` (backend database field, source of truth)

## Solution Overview

The migration script `fix-public-animal-sync.js` will:

1. **Analyze** your entire animals collection
2. **Identify** mismatches between isDisplay and showOnPublicProfile
3. **Report** public animals with private parents (causes visibility issues)
4. **Fix** the database to ensure consistency
5. **Sync** the PublicAnimal collection

## How to Use

### Step 1: Review Changes (DRY-RUN)

First, run the script in **dry-run mode** to see what would be changed:

```bash
cd c:\Projects\crittertrack-pedigree
node migrations\fix-public-animal-sync.js
```

This will show you:
- Total animals in your system
- How many have `isDisplay=true` and `showOnPublicProfile=true`
- List of animals with mismatched flags
- Public animals that have private parents

**Example Output:**
```
[MIGRATION] Starting public animal sync fix...
(DRY-RUN MODE - No changes will be made)

[STEP 1] Analyzing current state of animals...
  Total animals: 1,245
  Animals with isDisplay=true: 892
  Animals with showOnPublicProfile=true: 845
  Animals with mismatch (isDisplay !== showOnPublicProfile): 47

[STEP 2] Fixing mismatches...
  Found 47 mismatched animals:

    [MAKE PUBLIC] CTC1001 "Fluffy"
      isDisplay: true, showOnPublicProfile: false
      
    [MAKE PRIVATE] CTC1002 "Shadow"
      isDisplay: false, showOnPublicProfile: true
...
```

### Step 2: Apply Fixes

Once you've reviewed the dry-run output and it looks correct, apply the fixes:

```bash
node migrations\fix-public-animal-sync.js --fix
```

This will actually modify your database to:
- Fix all flag mismatches
- Re-sync the PublicAnimal collection
- Ensure parents are properly linked

**⚠️ WARNING:** This modifies your database. Make sure you have a backup first!

### Step 3: Verify Results

Run the dry-run again to confirm everything is fixed:

```bash
node migrations\fix-public-animal-sync.js
```

You should see:
- `Animals with mismatch: 0`
- `✓ All public animals have public parents`

## Flags Explained

### `--fix`
Actually apply changes to the database. Without this flag, it's a dry-run.

### `--verbose`
Show detailed information about each animal (species, creator, etc.)

## Examples

```bash
# Dry-run (default - safe to run anytime)
node migrations\fix-public-animal-sync.js

# Dry-run with verbose output
node migrations\fix-public-animal-sync.js --verbose

# Apply fixes
node migrations\fix-public-animal-sync.js --fix

# Apply fixes with verbose output (shows everything being changed)
node migrations\fix-public-animal-sync.js --fix --verbose
```

## What Gets Fixed

### Flag Mismatches
If `isDisplay ≠ showOnPublicProfile`, the script syncs them:
- `isDisplay=true` → `showOnPublicProfile=true` (make public)
- `isDisplay=false` → `showOnPublicProfile=false` (make private)

### PublicAnimal Collection
Re-syncs all animals to the PublicAnimal collection:
- **Private animals** are removed from PublicAnimal
- **Public animals** are added/updated in PublicAnimal with full data

### Pedigree Relationships
Identifies public animals with private parents and reports them. Parent animals must also be set to public to appear in pedigree views.

## Troubleshooting

### "Cannot connect to database"
Make sure you're running from the backend directory and .env is configured:

```bash
cd c:\Projects\crittertrack-pedigree
# Check that .env has MONGODB_URI set
cat .env | grep MONGODB_URI
```

### Missing environment variables
Add them to your `.env` file:
```
MONGODB_URI=mongodb+srv://...
JWT_SECRET=...
```

### Script times out or hangs
For large collections (10,000+ animals), the script may take a few minutes. This is normal.

## Understanding the Output

```
[STEP 4] Checking pedigree relationships...
  Public animals with parents: 456
  ⚠️  Found 12 public animals with PRIVATE parents:

    CTC1001 "Fluffy"
      Sire: CTC999 - PUBLIC: false ❌ PRIVATE
      Dam: CTC998 - PUBLIC: true ✓
```

This means:
- Animal CTC1001 is public
- Its sire (CTC999) is private → won't show in pedigree
- Its dam (CTC998) is public → will show in pedigree

**To fix:** Set CTC999 to public as well

## Questions?

If you encounter issues, check:
1. Database connection and credentials
2. Backup of your database exists
3. You have write permissions to the database
4. The script has permission to read/write files
