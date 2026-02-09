const { chromium } = require('playwright');
const fs = require('fs');

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
        const downloadLinkSelector = `a:has-text("bundle_${bundleId}_render.zip")`;
        const downloadLink = page.locator(downloadLinkSelector);
        
        // Wait up to 5 mins for the link to show up in chat
        await downloadLink.waitFor({ state: 'visible', timeout: 300000 });

        console.log("🎯 Link found! Starting download...");
        
        // INCREASED DOWNLOAD TIMEOUT HERE
        const [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 300000 }), 
            downloadLink.click(),
        ]);

        const fileName = `bundle_${bundleId}_render.zip`;
        await download.saveAs(fileName);
        console.log(`✅ SUCCESS: Saved as ${fileName}`);

    } catch (err) {
        console.error("❌ Automation Error:", err.message);
        await page.screenshot({ path: 'error_debug.png' });
        process.exit(1);
    } finally {
        await browser.close();
    }
}

run();
