const axios = require('axios');

axios.get('https://www.simplebreed.com/profile?uid=22471', {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
    },
    timeout: 20000
}).then(r => {
    const html = r.data;
    // Extract all JS/AJAX related strings
    const ajaxUrls = [...html.matchAll(/["'`]([\/][a-z][^"'`\s]{2,})["'`]/gi)].map(m => m[1]);
    const uniqueUrls = [...new Set(ajaxUrls)].filter(u =>
        /breed|animal|list|search|profile|conts|public|ajax|api/i.test(u)
    );
    console.log('Interesting URLs in JS/HTML:');
    uniqueUrls.forEach(u => console.log(' ', u));

    // Look for offset/limit/page patterns
    const lazyMatches = html.match(/.{0,100}(offset|limit|page=|loadmore|lazy|ajax).{0,100}/gi) || [];
    console.log('\nLazy/AJAX context snippets:');
    lazyMatches.slice(0, 10).forEach(m => console.log(' ', m.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()));
}).catch(e => console.error(e.message));
