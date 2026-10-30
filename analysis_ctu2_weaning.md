# CTU2 Litter Weaning Analysis - Final

## Overview
CTU2 is a user account in the crittertrack pedigree system. The user reports: "the button is to assign litter as weaned. but that should only show on litters that are within our boundary and didnt get a weaning date assigned".

This means the "weaned button" (Confirm weaning action) should only appear on litters that:
1. Are within the nursing boundary (not past the species-specific maxNursingDays cutoff, default 90 days)
2. Haven't already had a weaning date assigned

## Key Fields governing the weaned button
- `weaningDate`: Date when weaning was recorded (auto or manual)
- `weaningConfirmed`: Boolean - whether the user explicitly confirmed weaning
- `litterSizeWeaned`: Number of offspring recorded as weaned
- `weaningDismissed`: Whether the user dismissed the weaning notification
- `birthDate`: When the litter was born (needed to calculate nursing age)

## Why some litters have the weaned button mark AND some don't

### **Litters SHOWING the weaned button** (should get the "Confirm weaning" option)
These litters meet BOTH conditions:
1. **Within nursing boundary**: `daysSince(birthDate) <= maxNursingDays` for the litter's species
2. **No weaning date assigned**: Either no `weaningDate` set, OR `weaningConfirmed: false`

**Example scenarios**:
- Litter born 60 days ago, no weaningDate → SHOW button (within boundary, not weaned)
- Litter born 60 days ago, `weaningDate` set but `weaningConfirmed: false` → SHOW button (within boundary, not confirmed)
- Litter born 30 days ago → SHOW button

### **Litters NOT showing the weaned button** (should NOT get the "Confirm weaning" option)
These litters fail ONE or BOTH conditions:

#### **1. Already fully weaned** (`weaningConfirmed: true`)
- User already clicked "Confirm weaning"
- Litter is closed for nursing
- Button should NOT appear

**Example**: LIT-B from seed data has `weaningConfirmed: true`, `weaningDate` set → NO button

#### **2. Past nursing cutoff boundary** (`daysSince(birthDate) > maxNursingDays`)
- Litter is older than the species' realistic nursing window
- The dam's Nursing flag is auto-cleared after this cutoff
- Button should NOT appear (litter is considered "closed")

**Example from user report**: "showing litters way up till last year with a weaning button" → These litters are > 90 days old and should NOT show the button

#### **3. Litter not yet born** (no `birthDate`)
- Weaning cannot be confirmed before birth
- Button should NOT appear

#### **4. Litter with `litterSizeWeaned: 0` and no confirmation**
- System may have recorded a weaning date but user hasn't confirmed
- Button should appear only if within boundary AND not confirmed

## The Weaned Button Visibility Logic

The frontend should determine button visibility using this logic:

```javascript
// Get the nursing cutoff for this litter's species
const maxNursingDays = getLitterMaxNursingDays(litter); // defaults to 90

// Calculate days since birth
const daysSinceBirth = litter.birthDate ? Math.floor((today - new Date(litter.birthDate)) / 86400000) : null;

// Show the "Confirm weaning" button ONLY if:
// 1. Litter has a birth date (is born)
// 2. Litter is within the nursing boundary (daysSinceBirth <= maxNursingDays)
// 3. Litter doesn't already have weaning confirmed
const showWeanedButton = 
    !!litter.birthDate && 
    daysSinceBirth <= maxNursingDays && 
    !litter.weaningConfirmed;
```

## Why the Current System May Be Buggy

**User reported issue**: "we have a weaning cut-off and its showing litters way up till last year with a weaning button. so that needs finetuning then"

**Root cause**: The weaned button visibility may not be properly checking:
1. Whether the litter is within the nursing boundary (daysSinceBirth <= maxNursingDays)
2. Whether the litter already has weaningConfirmed set

**Scenario causing the bug**:
1. Litter born 200 days ago (last year)
2. `weaningConfirmed: false`, `litterSizeWeaned: 0`
3. Current code may show the button because it only checks `litterSizeWeaned !== null`
4. But the litter is PAST the 90-day cutoff, so the button should NOT appear

**Fix required**: Implement the full boundary check as shown in the logic above, ensuring:
- Button only appears for litters within the nursing cutoff
- Button does NOT appear for already-confirmed weaned litters
- Button does NOT appear for litters past the nursing boundary

## CTU2 Specific Analysis

For the CTU2 user account:
- Check all CTU2 litters for `birthDate` presence
- Calculate `daysSinceBirth` for each litter
- Apply the `maxNursingDays` cutoff per litter's species
- Verify that `weaningConfirmed: false` litters within the boundary show the button
- Verify that litters past the boundary or with `weaningConfirmed: true` do NOT show the button

The finetuning needed is to ensure the weaned button visibility logic properly checks BOTH the nursing boundary AND the weaning confirmation status, rather than just checking if `litterSizeWeaned` is set.
# CTU2 Litter Weaning Analysis

## Overview
CTU2 is a user account in the crittertrack pedigree system. This analysis explains why some CTU2 litters have the "weaned button" mark and some do not.

## Key Fields governing the weaned button
- `weaningDate`: Date when weaning was recorded (can be auto-set or manual)
- `weaningConfirmed`: Boolean - whether the user explicitly confirmed weaning
- `litterSizeWeaned`: Number of offspring recorded as weaned
- `weaningDismissed`: Whether the user dismissed the weaning notification

## Why some litters have the weaned button mark

### **Litters WITH the weaned button** (`weaningConfirmed: true`)
- User clicked the "Confirm weaning" action
- Sets `weaningDate` and `weaningConfirmed: true`
- `litterSizeWeaned` is populated
- Litter is considered "closed" for nursing

**Example**: LIT-B from seed data has `weaningConfirmed: true`, `weaningDate` set, `litterSizeWeaned: 7`

### **Litters WITHOUT the weaned button** (`weaningConfirmed: false` or absent)

#### **1. Litter not yet born** (no `birthDate`)
- Weaning cannot be confirmed before birth
- Example: LIT-D has `birthDate: null`

#### **2. Litter born but weaning not explicitly confirmed**
- Litter has `birthDate` set, offspring are nursing
- `weaningDate` may be set (auto-after 90-day cutoff or manual)
- BUT `weaningConfirmed: false` remains until user clicks "Confirm weaning"
- System records date but doesn't mark as fully weaned

**Example**: LIT-A has `birthDate` set, `weaningDate` set, but `weaningConfirmed: false`, `litterSizeWeaned: 0`

#### **3. Weaning was dismissed**
- `weaningDismissed: true` can coexist with `weaningConfirmed: true`
- Affects notification display but not the weaned state itself

## Critical Distinction: Date vs. Confirmation

| Action | `weaningDate` | `weaningConfirmed` | `litterSizeWeaned` | Status |
|--------|--------------|-------------------|-------------------|--------|
| Auto-weaning (after 90 days) | Set automatically | `false` | `0` | "pending" |
| "Confirm weaning" button | Set to today | `true` | Populated | "value" (fully weaned) |
| Litter not yet born | `null` | `false` | `null` | Not applicable |

## Frontend Logic (from helpers.js)
```javascript
const weaned = numOrNull(litter.litterSizeWeaned ?? litter.numberWeaned);
const weanedState = weaned !== null ? 'value' : (isBorn && !litter.weaningConfirmed ? 'pending' : 'missing');
```

The "weaned button" mark appears as 'value' (fully weaned) only when `litterSizeWeaned` is not null, which happens exclusively after the explicit "Confirm weaning" action sets `weaningConfirmed: true`.