const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function run() {
    const token = process.env.DISCORD_TOKEN;
    const channelId = process.env.CHANNEL_ID;
    const guildId = process.env.GUILD_ID;
    const bundleId = process.env.BUNDLE_ID;

    // Create logs folder for debugging
    if (!fs.existsSync('logs')) fs.mkdirSync('logs');

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        console.log("🌐 Navigating to Discord...");
        await page.goto('https://discord.com/login');

        // Inject Token to bypass the login screen
        await page.evaluate((token) => {
            function login(token) {
                setInterval(() => {
                    document.body.appendChild(document.createElement`iframe`).contentWindow.localStorage.token = `"${token}"`;
                }, 50);
                setTimeout(() => { location.reload(); }, 2500);
            }
            login(token);
        }, token);

        // Wait for Discord UI to load
        await page.waitForURL(/.*channels.*/, { timeout: 60000 });
        console.log("✅ Logged in to Alt Account.");

        // Go to the specific Server/Channel
        await page.goto(`https://discord.com/channels/${guildId}/${channelId}`);
        
        // Find the chat box
        const messageBox = page.locator('[role="textbox"]');
        await messageBox.waitFor({ state: 'visible' });

        console.log(`💬 Sending Command: !download ${bundleId}`);
        await messageBox.fill(`!download ${bundleId}`);
        await page.keyboard.press('Enter');

        // ⏳ Wait for the bot to upload a file (intercepting the CDN link)
        console.log("⏳ Waiting for bot response file...");
        
        const responsePromise = page.waitForResponse(res => 
            res.url().includes('cdn.discordapp.com/attachments') && res.status() === 200,
            { timeout: 120000 } // Giving it 2 minutes to process
        );

        const response = await responsePromise;

        if (response) {
            const buffer = await response.body();
            // Try to get filename from URL or default to bundle_id
            const urlParts = response.url().split('/');
            const originalName = urlParts[urlParts.length - 1].split('?')[0];
            const fileName = originalName || `bundle_${bundleId}.obj`;

            fs.writeFileSync(fileName, buffer);
            console.log(`✅ SUCCESS: Saved file as ${fileName}`);
        }

    } catch (err) {
        console.error("❌ Automation Error:", err.message);
        // Save screenshot for GitHub Step s_06
        await page.screenshot({ path: 'error_debug.png' });
        fs.writeFileSync('logs/error_log.txt', err.stack);
        process.exit(1);
    } finally {
        await browser.close();
    }
}

run();
