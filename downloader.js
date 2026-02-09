const { chromium } = require('playwright');
const fs = require('fs');
const axios = require('axios');

async function run() {
    const token = process.env.DISCORD_TOKEN;
    const channelId = process.env.CHANNEL_ID;
    const guildId = process.env.GUILD_ID;
    const bundleId = process.env.BUNDLE_ID;

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        console.log("🌐 Navigating to Discord...");
        await page.goto('https://discord.com/login');

        // Inject Token
        await page.evaluate((token) => {
            setInterval(() => {
                document.body.appendChild(document.createElement`iframe`).contentWindow.localStorage.token = `"${token}"`;
            }, 50);
            setTimeout(() => { location.reload(); }, 2500);
        }, token);

        await page.waitForURL(/.*channels.*/, { timeout: 60000 });
        console.log("✅ Logged in.");

        await page.goto(`https://discord.com/channels/${guildId}/${channelId}`);
        const messageBox = page.locator('[role="textbox"]');
        await messageBox.waitFor({ state: 'visible' });

        // Trigger Slash Command
        console.log(`💬 Triggering Slash Command for ID: ${bundleId}`);
        await messageBox.click();
        await page.keyboard.type('/bundle render', { delay: 150 });
        await page.waitForTimeout(2000); 
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1000);
        await page.keyboard.type(bundleId.toString(), { delay: 100 });
        await page.waitForTimeout(1000);
        await page.keyboard.press('Enter');

        console.log("⏳ Waiting for the download link to appear...");
        // This selector targets the specific link text seen in your screenshot
        const downloadLinkSelector = `a[href*="cdn.discordapp.com/attachments"]:has-text("bundle_${bundleId}")`;
        const downloadLink = page.locator(downloadLinkSelector);
        
        await downloadLink.waitFor({ state: 'visible', timeout: 300000 });
        
        // GRAB URL DIRECTLY (Fast Fix)
        const fileUrl = await downloadLink.getAttribute('href');
        console.log(`🎯 Link found! Starting download via axios...`);

        const response = await axios({
            method: 'get',
            url: fileUrl,
            responseType: 'arraybuffer'
        });

        const fileName = `bundle_${bundleId}_render.zip`;
        fs.writeFileSync(fileName, response.data);
        console.log(`✅ SUCCESS: Saved ${fileName} (${(response.data.length / 1024 / 1024).toFixed(2)} MB)`);

    } catch (err) {
        console.error("❌ Automation Error:", err.message);
        await page.screenshot({ path: 'error_debug.png' });
        process.exit(1);
    } finally {
        await browser.close();
    }
}

run();
