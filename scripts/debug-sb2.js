const axios = require('axios');
axios.get('https://www.simplebreed.com/profile?uid=22471', {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html' }, timeout: 20000
}).then(r => {
    const html = r.data;
    const listStart = html.indexOf('24778');
    const chunk = html.slice(Math.max(0, listStart - 200), listStart + 8000);
    const stripped = chunk.replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    console.log(stripped.slice(0, 3000));
}).catch(e => console.error(e.message));
