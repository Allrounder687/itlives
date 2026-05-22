const https = require('https');
https.get('https://wallhaven.cc/api/v1/collections/DeviateFish', (res) => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
        let j = JSON.parse(d);
        let arr = j.data
            .filter(c => !c.label.toLowerCase().includes('nsfw') && !c.label.toLowerCase().includes('suicide'))
            .map(c => ({
                label: c.label,
                url: `https://wallhaven.cc/user/DeviateFish/collections/${c.id}`
            }));
        console.log(JSON.stringify(arr, null, 2));
    });
});
