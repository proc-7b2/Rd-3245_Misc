const fs = require('fs');
const axios = require('axios');
const path = require('path');

// Helper for rate-limiting (prevents 429 Too Many Requests)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Setup Logging Directory for "s_06" artifact upload
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

async function downloadBundle() {
    // 1. Support both n8n payload (BUNDLE_ID) and Manual Input (TARGET_URL)
    const bundleId = process.env.BUNDLE_ID || process.env.TARGET_URL;

    if (!bundleId) {
        const msg = "❌ Error: No Bundle ID provided in environment variables.";
        console.error(msg);
        fs.writeFileSync(path.join(logDir, 'error.txt'), msg);
        process.exit(1);
    }

    console.log(`🚀 Processing Bundle ID: ${bundleId}`);

    try {
        // 2. Add Headers to look like a real browser (Avoids 403 Forbidden)
        const config = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json'
            }
        };

        // 3. Get Bundle Details
        const catalogUrl = `https://catalog.roblox.com/v1/bundles/${bundleId}/details`;
        const response = await axios.get(catalogUrl, config);
        const items = response.data.items;

        console.log(`🔍 Found ${items.length} items. Starting download...`);

        for (const item of items) {
            // We only want Assets (meshes/textures), not "User" or other types
            if (item.type === 'Asset') {
                console.log(`📥 Downloading: ${item.name} (ID: ${item.id})`);
                
                const assetUrl = `https://assetdelivery.roblox.com/v1/asset/?id=${item.id}`;
                const assetData = await axios.get(assetUrl, { 
                    responseType: 'arraybuffer',
                    headers: config.headers 
                });

                // Clean the filename so it doesn't break Linux/Windows filesystems
                const safeName = item.name.replace(/[^a-z0-9]/gi, '_');
                const fileName = `${safeName}_${item.id}.rbxm`;

                fs.writeFileSync(fileName, assetData.data);

                // Wait 2 seconds to be safe
                await sleep(2000); 
            }
        }

        console.log("✅ Finished successfully.");
        
        // Write a success log for records
        fs.writeFileSync(path.join(logDir, 'status.txt'), 'success');

    } catch (error) {
        // 4. Critical: Write error to file so GitHub Actions "s_06" can save it
        const errorMsg = `❌ Failed for Bundle ${bundleId}: ${error.message}\nStack: ${error.stack}`;
        console.error(errorMsg);
        fs.writeFileSync(path.join(logDir, 'error.txt'), errorMsg);
        process.exit(1);
    }
}

downloadBundle();
