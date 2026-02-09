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
        await messageBox.click();

        // --- FIXED SLASH COMMAND SEQUENCE ---
        console.log(`💬 Triggering Slash Command for ID: ${bundleId}`);
        
        // 1. Type the start of the command slowly
        await page.keyboard.type('/bundle render', { delay: 200 });
        await page.waitForTimeout(2000); // Wait for menu to appear
        
        // 2. Press Tab or Enter to select the command from the menu
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1000);

        // 3. Now type the ID into the parameter field
        await page.keyboard.type(bundleId.toString(), { delay: 150 });
        await page.waitForTimeout(1000);
        
        // 4. Send the command
        await page.keyboard.press('Enter');
        console.log("🚀 Command sent. Waiting up to 5 minutes for render...");

        // --- 5 MINUTE TIMEOUT FOR FILE ---
        const responsePromise = page.waitForResponse(res => 
            res.url().includes('cdn.discordapp.com/attachments') && res.status() === 200,
            { timeout: 300000 } // 5 minutes (300,000 ms)
        );

        const response = await responsePromise;
        const buffer = await response.body();
        
        const urlParts = response.url().split('/');
        const fileName = `model_${bundleId}_${Date.now()}.obj`;

        fs.writeFileSync(fileName, buffer);
        console.log(`✅ SUCCESS: Saved as ${fileName}`);

    } catch (err) {
        console.error("❌ Automation Error:", err.message);
        // Take a screenshot to see the "Unhandled Error" message
        await page.screenshot({ path: 'error_debug.png' });
        process.exit(1);
    } finally {
        await browser.close();
    }
}

run();
