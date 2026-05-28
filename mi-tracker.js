import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import TelegramBot from 'node-telegram-bot-api';

puppeteer.use(StealthPlugin());

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const TARGET_URL = 'https://www.mi.com/rs/product/poco-x8-pro/buy/?gid=4223715620';
const STATE_FILE = path.join(process.cwd(), 'mi_state.json');

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });

function loadState() {
  if (!fs.existsSync(STATE_FILE)) {
    return { lastPrice: 39000, notified: false };
  }
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
  } catch (e) {
    return { lastPrice: 39000, notified: false };
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

(async () => {
    let browser;
    try {
        console.log('Pokrećem pretraživač za Xiaomi cenu...');
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
        });
        
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        
        console.log(`Otvaram URL: ${TARGET_URL}`);
        await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        console.log('Čekam 5 sekundi da se učita cena...');
        await new Promise(r => setTimeout(r, 5000));
        
        // Izvlačimo cenu sa stranice
        const priceText = await page.evaluate(() => {
            const el = document.querySelector('.buy-product__installment-price__sale strong');
            return el ? el.innerText.trim() : null;
        });
        
        if (!priceText) {
            throw new Error('Nije pronađen element sa cenom na stranici. Moguće je da se struktura sajta promenila.');
        }
        
        console.log(`Pronađen tekst cene: ${priceText}`);
        
        // Parsovanje cene (npr "38.999,00 RSD" -> 38999)
        const price = parseFloat(priceText.replace(/\./g, '').replace(',', '.').replace(/[^0-9.]/g, ''));
        
        if (isNaN(price)) {
            throw new Error(`Neuspešno parsovanje cene iz teksta: "${priceText}"`);
        }
        
        console.log(`Parsovana cena: ${price} RSD`);
        
        const state = loadState();
        console.log(`Prethodna zabeležena cena: ${state.lastPrice} RSD (Notifikovano: ${state.notified})`);
        
        // Ako je cena promenjena
        if (price !== state.lastPrice) {
            console.log(`Cena se promenila sa ${state.lastPrice} na ${price}`);
            
            if (price < 39000) {
                console.log(`Cena je ispod 39000 RSD! Šaljem obaveštenje...`);
                const message = `📱 *POCO X8 Pro cena je pala ispod 39.000 RSD!*\n\n*Nova cena:* \`${priceText}\` (bila je: \`${state.lastPrice.toLocaleString('sr-RS')} RSD\`)\n\n[Kupi na Mi.com](${TARGET_URL})`;
                
                await bot.sendMessage(CHAT_ID, message, { parse_mode: 'Markdown' });
                state.notified = true;
            } else {
                state.notified = false;
            }
            
            state.lastPrice = price;
            saveState(state);
        } else {
            console.log('Cena je ista kao i prethodni put. Nema izmena.');
        }
        
    } catch (error) {
        console.error('Kritična greška u mi-trackeru:', error.message);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
})();
