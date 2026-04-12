const axios = require('axios');
const cheerio = require('cheerio');

axios.post(
    'https://www.simplebreed.com/user_animals?uid=22471&cid=112&klStep=25',
    'status=all&gender=all',
    {
        headers: {
            'User-Agent': 'Mozilla/5.0',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'text/html'
        },
        timeout: 15000
    }
).then(r => {
    const $ = cheerio.load(r.data);
    const ids = [];
    $('a[href*="/animal?aid="]').each((_, el) => {
        const m = ($(el).attr('href') || '').match(/aid=(\d+)/);
        if (m && !ids.includes(m[1])) ids.push(m[1]);
    });
    console.log('animals returned:', ids.length, ids);
    const nd = $('.nextData').first();
    console.log('nextData href:', nd.attr('href') || 'none');
    console.log('nextData animal-count:', nd.attr('animal-count') || 'none');
}).catch(e => console.error(e.response && e.response.status, e.message));
