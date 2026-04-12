const axios = require('axios');
const cheerio = require('cheerio');

axios.get('https://www.simplebreed.com/profile?uid=22471', {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html' }, timeout: 20000
}).then(async r => {
    const $ = cheerio.load(r.data);

    // Find nextData element
    const nd = $('.nextData').first();
    console.log('nextData outerHTML:', $.html(nd).slice(0, 500));

    // Find all elements inside .user_animals
    const ua = $('.user_animals');
    console.log('\n.user_animals children count:', ua.children().length);
    ua.children().each((i, el) => {
        const text = $(el).text().replace(/\s+/g, ' ').trim().slice(0, 80);
        const link = $(el).find('a[href*="animal?aid"]').attr('href') || $(el).attr('href') || '';
        console.log(`  [${i}] ${link} | ${text}`);
    });
}).catch(e => console.error(e.message));
