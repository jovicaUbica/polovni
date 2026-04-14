async function test() {
  try {
    const res = await fetch('https://www.polovniautomobili.com/auto-oglasi/pretraga?page=1&sort=renewDate_desc', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,sr;q=0.8'
      }
    });
    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Length:", text.length);
    if(res.status !== 200) console.log(text.substring(0, 500));
  } catch (err) {
    console.error("Error:", err.message);
  }
}
test();
