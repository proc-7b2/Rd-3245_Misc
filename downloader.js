const { chromium } = require('playwright');
const fs = require('fs');
const axios = require('axios');

async function run() {
    const token = process.env.DISCORD_TOKEN;
    const channelId = process.env.CHANNEL_ID;
    const guildId = process.env.GUILD_ID;
    const bundleId = process.env.BUNDLE_ID;

    let statusData = {
        bundleId: bundleId,
        status: "Pending",
        message: "",
        timestamp: new Date().toISOString()
    };

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        await page.goto('https://discord.com/login');
        await page.evaluate((token) => {
            setInterval(() => {
                document.body.appendChild(document.createElement`iframe`).contentWindow.localStorage.token = `"${token}"`;
            }, 50);
            setTimeout(() => { location.reload(); }, 2500);
        }, token);

        await page.waitForURL(/.*channels.*/, { timeout: 60000 });
        await page.goto(`https://discord.com/channels/${guildId}/${channelId}`);
        
        const messageBox = page.locator('[role="textbox"]');
        await messageBox.waitFor({ state: 'visible' });

        await messageBox.click();
        await page.keyboard.type('/bundle render', { delay: 150 });
        await page.waitForTimeout(2000); 
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1000);
        await page.keyboard.type(bundleId.toString(), { delay: 100 });
        await page.waitForTimeout(1000);
        await page.keyboard.press('Enter');

        console.log("⏳ Waiting for bot response...");

        // Wait for the most recent message from the bot
        const lastMessage = page.locator('li[class*="message"]').last();
        await lastMessage.waitFor({ state: 'visible', timeout: 300000 });

        // Check if there is a download link
        const downloadLink = lastMessage.locator(`a[href*="cdn.discordapp.com/attachments"]`);
        const linkCount = await downloadLink.count();

        if (linkCount > 0) {
            // SUCCESS CASE
            const fileUrl = await downloadLink.getAttribute('href');
            const response = await axios({ method: 'get', url: fileUrl, responseType: 'arraybuffer' });
            fs.writeFileSync(`bundle_${bundleId}_render.zip`, response.data);
            
            statusData.status = "Success";
            statusData.message = "File successfully retrieved.";
            console.log("✅ Success recorded.");
        } else {
            // ERROR CASE (Bot replied but no link)
            const botText = await lastMessage.innerText();
            statusData.status = "Error";
            statusData.message = `Bot Error: ${botText.split('\n')[0]}`; // Get first line of error
            console.log(`❌ Bot Error recorded: ${statusData.message}`);
        }

    } catch (err) {
        statusData.status = "System_Error";
        statusData.message = err.message;
        await page.screenshot({ path: 'error_debug.png' });
    } finally {
        // Save the status.json file
        fs.writeFileSync('status.json', JSON.stringify(statusData, null, 4));
        await browser.close();
    }
}

run();
