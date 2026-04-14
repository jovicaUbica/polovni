import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import TelegramBot from 'node-telegram-bot-api';

puppeteer.use(StealthPlugin());

// --- CONFIGURATION ---
const TELEGRAM_TOKEN = '8686474512:AAH163aFtGN4K6mBMmZbddyYjz2EfpRBn5g';
const CHAT_ID = '6635702095';const TARGET_URL = 'https://www.polovniautomobili.com/auto-oglasi/pretraga?page=1&sort=renewDate_desc';
const DB_FILE = path.join(process.cwd(), 'seen_ads.json');

// --- INITIALIZE TELEGRAM BOT ---
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });
function loadSeenAds() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify([]));
    return new Set();
  }
  const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  return new Set(data);
}

function saveSeenAd(id, seenAds) {
  seenAds.add(id);
  fs.writeFileSync(DB_FILE, JSON.stringify([...seenAds], null, 2));
}

(async () => {
    console.log('Pokrećem pretraživač (Puppeteer) da zaobiđem zaštite...');
    const browser = await puppeteer.launch({
        headless: 'new', // sakriven prozor
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
    });
    
    // Otvaramo jedan tab (page) i koristimo ga stalno (brže i štedi RAM)
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    const seenAds = loadSeenAds();
    
    console.log('----------------------------------------------------');
    console.log('🚀 Sistem za automatsko praćenje oglasa je POKRENUT!');
    console.log(`🔗 Pratim URL: ${TARGET_URL}`);
    console.log('----------------------------------------------------');

    // Glavna petlja koja vrši pretragu svakih 60 sekundi
    while (true) {
        try {
            console.log(`\n⏰ [${new Date().toLocaleTimeString()}] Učitavam oglase...`);
            
            // Otvorimo stranicu
            await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
            
            // Izvlačimo oglase direktno iz browsera
            const ads = await page.evaluate(() => {
                const results = [];
                // Trazimo i article i div elemente (za svaki slucaj)
                const items = document.querySelectorAll('article, div.classified');
                
                for (let el of items) {
                    const titleEl = el.querySelector('h2 a, h3 a');
                    if (!titleEl) continue;
                    
                    const href = titleEl.getAttribute('href');
                    const title = titleEl.innerText.trim() || 'Bez naslova';
                    
                    if (href) {
                        const url = href.startsWith('http') ? href : `https://www.polovniautomobili.com${href}`;
                        const idMatch = href.match(/\/auto-oglasi\/(\d+)\//);
                        const id = idMatch ? idMatch[1] : null;

                        if (id) {
                            results.push({ id, title, url });
                        }
                    }
                }
                return results;
            });

            let newAdsCount = 0;
            for (let ad of ads) {
                if (!seenAds.has(ad.id)) {
                    console.log(`>>> [NOVI OGLAS]: ${ad.title}`);
                    console.log(`    Link: ${ad.url}`);
                    
                    saveSeenAd(ad.id, seenAds);
                    newAdsCount++;

                    // 2. Šaljemo obaveštenje na Telegram
                    const message = `🚨 *Novi Oglas!*\n\n*${ad.title}*\n[Pogledaj na sajtu](${ad.url})`;
                    bot.sendMessage(CHAT_ID, message, { parse_mode: 'Markdown', disable_web_page_preview: false })
                      .catch(err => console.log('Greska pri slanju telegram poruke:', err.message));
                }
            }

            console.log(`Skeniranje uspješno, pronađeno novih na prvoj stranici: ${newAdsCount}`);
        } catch (error) {
            console.error('Došlo je do greške u petlji:', error.message);
        }

        if (process.env.GITHUB_ACTIONS) {
            console.log('Završeno pokretanje na GitHub Actions, gasim browser...');
            await browser.close();
            process.exit(0);
        }

        // Čekamo 60 sekundi (60000 milisekundi)
        console.log('...čekam 60 sekundi do sledeće provere...');
        await new Promise(resolve => setTimeout(resolve, 60000));
    }

})();
