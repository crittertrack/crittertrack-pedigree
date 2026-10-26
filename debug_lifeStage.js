// Debug script for lifeStageUtils
const { calculateLifeStageFromBirthDate, getLifespanDays } = require('./utils/lifeStageUtils');

console.log('null:', calculateLifeStageFromBirthDate(null));
console.log('undefined:', calculateLifeStageFromBirthDate(undefined));
console.log('empty string:', calculateLifeStageFromBirthDate(''));
console.log('not-a-date:', calculateLifeStageFromBirthDate('not-a-date'));

// Check lifespan days for Guinea Pig
console.log('Guinea Pig lifespan days:', getLifespanDays('Guinea Pig'));
const lifespan = getLifespanDays('Guinea Pig');
const adultThreshold = lifespan * 0.75;
console.log('Adult threshold (75%):', adultThreshold);

// Test makeBirthDate logic manually
for (let daysAgo = 0; daysAgo <= 2000; daysAgo += 500) {
    const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
    const stage = calculateLifeStageFromBirthDate(date, 'Guinea Pig');
    console.log(`${daysAgo} days ago -> ${stage}`);
}

