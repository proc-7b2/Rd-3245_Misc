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

    // Initial status template
    let statusData = {
        bundleId: bundleId,
        status: "Pending",
        message: "",
        timestamp: new Date().toISOString()
    };

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
        
        const downloadLink = page.locator(`a:has-text("${bundleId}")`).last();
        
        try {
            // Wait up to 5 minutes
            await downloadLink.waitFor({ state: 'visible', timeout: 300000 });
            await page.waitForTimeout(2000);

            const fileUrl = await downloadLink.getAttribute('href');
            if (!fileUrl) throw new Error("Link found but href missing.");

            console.log(`🎯 URL Found: ${fileUrl}`);
            const response = await axios({ method: 'get', url: fileUrl, responseType: 'arraybuffer' });

            const fileName = `bundle_${bundleId}_render.zip`;
            fs.writeFileSync(fileName, response.data);
            
            statusData.status = "Success";
            statusData.message = "File downloaded and saved successfully.";
            console.log(`✅ SUCCESS: Saved ${fileName}`);

        } catch (waitError) {
            // If the link didn't show up, check if the bot sent an error message text instead
            const lastMsg = await page.locator('[class*="messageContent"]').last();
            const errorMsg = await lastMsg.innerText();
            
            statusData.status = "Error";
            statusData.message = errorMsg || "The file cannot be given (Timeout/No link).";
            
            // Capture a screenshot so you can see the bot's error message
            await page.screenshot({ path: 'error_debug.png' });
            console.log("❌ Bot error captured.");
        }

    } catch (err) {
        console.error("❌ Automation Error:", err.message);
        await page.screenshot({ path: 'error_debug.png' });
        statusData.status = "System_Error";
        statusData.message = err.message;
    } finally {
        // SAVE THE JSON FILE
        fs.writeFileSync('status.json', JSON.stringify(statusData, null, 4));
        console.log("📝 status.json saved.");
        await browser.close();
    }
}

run();
