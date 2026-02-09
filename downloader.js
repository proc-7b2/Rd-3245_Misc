const fs = require('fs');
const axios = require('axios');

// Helper for rate-limiting
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function downloadBundle() {
    const bundleId = process.env.BUNDLE_ID;

    if (!bundleId) {
        console.error("❌ Error: No BUNDLE_ID provided.");
        process.exit(1);
    }

    try {
        const catalogUrl = `https://catalog.roblox.com/v1/bundles/${bundleId}/details`;
        const response = await axios.get(catalogUrl);
        const items = response.data.items;

        console.log(`🔍 Found ${items.length} items. Starting download...`);

        for (const item of items) {
            if (item.type === 'Asset') {
                console.log(`📥 Downloading: ${item.name}`);
                
                const assetUrl = `https://assetdelivery.roblox.com/v1/asset/?id=${item.id}`;
                const assetData = await axios.get(assetUrl, { responseType: 'arraybuffer' });

                const safeName = item.name.replace(/[^a-z0-9]/gi, '_');
                fs.writeFileSync(`${safeName}.rbxm`, assetData.data);

                // Wait 1.5 seconds between items to prevent rate limits
                await sleep(1500); 
            }
        }
        console.log("✅ Finished.");
    } catch (error) {
        console.error("❌ API Error:", error.message);
        process.exit(1);
    }
}

downloadBundle();
