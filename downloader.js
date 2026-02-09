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

        // --- STEP 1: TRIGGER COMMAND ---
        console.log(`💬 Triggering Slash Command for ID: ${bundleId}`);
        await messageBox.click();
        await page.keyboard.type('/bundle render', { delay: 150 });
        await page.waitForTimeout(2000); 
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1000);
        await page.keyboard.type(bundleId.toString(), { delay: 100 });
        await page.waitForTimeout(1000);
        await page.keyboard.press('Enter');

        // --- STEP 2: WAIT FOR EPHEMERAL LINK ---
        console.log("⏳ Waiting up to 5 minutes for the blue download link...");
        
        // We look for the link text specifically seen in your screenshot
        const downloadLinkSelector = `a:has-text("bundle_${bundleId}_render.zip")`;
        
        // Wait for the link to appear in the UI
        const downloadLink = page.locator(downloadLinkSelector);
        await downloadLink.waitFor({ state: 'visible', timeout: 300000 });

        console.log("🎯 Link found! Starting download...");
        
        // --- STEP 3: CAPTURE THE DOWNLOAD ---
        const [download] = await Promise.all([
            page.waitForEvent('download'), // Wait for download to start
            downloadLink.click(),          // Click the link
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
