const { chromium } = require('playwright');
const fs = require('fs');

async function run() {
    const token = process.env.DISCORD_TOKEN;
    const channelId = process.env.CHANNEL_ID;
    const guildId = process.env.GUILD_ID;
    const bundleId = process.env.BUNDLE_ID;

    if (!fs.existsSync('logs')) fs.mkdirSync('logs');

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        console.log("🌐 Navigating to Discord...");
        await page.goto('https://discord.com/login');

        // Login via Token
        await page.evaluate((token) => {
            setInterval(() => {
                document.body.appendChild(document.createElement`iframe`).contentWindow.localStorage.token = `"${token}"`;
            }, 50);
            setTimeout(() => { location.reload(); }, 2500);
        }, token);

        await page.waitForURL(/.*channels.*/, { timeout: 60000 });
        console.log("✅ Logged in.");

        await page.goto(`https://discord.com/channels/${guildId}/${channelId}`);
        
        // 1. Click the Chat Box
        const messageBox = page.locator('[role="textbox"]');
        await messageBox.waitFor({ state: 'visible' });
        await messageBox.click();

        // 2. Type the Slash Command
        console.log(`💬 Triggering Slash Command: /bundle render id:${bundleId}`);
        await page.keyboard.type(`/bundle render id:${bundleId}`, { delay: 100 });

        // 3. Wait for and Select the Command from the Pop-up
        // Discord shows a suggestion list; we press Enter to confirm the selection
        await page.waitForTimeout(1500); // Wait for the menu to pop up
        await page.keyboard.press('Enter'); 
        await page.waitForTimeout(500);
        await page.keyboard.press('Enter'); // Press Enter again to send it

        console.log("⏳ Waiting for bot response file...");
        
        // 4. Intercept the File Download
        const responsePromise = page.waitForResponse(res => 
            res.url().includes('cdn.discordapp.com/attachments') && res.status() === 200,
            { timeout: 150000 } 
        );

        const response = await responsePromise;
        const buffer = await response.body();
        
        // Extract filename from URL
        const urlParts = response.url().split('/');
        const fileName = urlParts[urlParts.length - 1].split('?')[0] || `render_${bundleId}.obj`;

        fs.writeFileSync(fileName, buffer);
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
