const fs = require('fs');
const axios = require('axios');

async function downloadBundle() {
    const bundleId = process.env.BUNDLE_ID;

    if (!bundleId) {
        console.error("❌ Error: No BUNDLE_ID provided by n8n.");
        process.exit(1);
    }

    console.log(`🚀 Starting download for Bundle ID: ${bundleId}`);

    try {
        // 1. Get the list of assets inside the bundle
        const catalogUrl = `https://catalog.roblox.com/v1/bundles/${bundleId}/details`;
        const response = await axios.get(catalogUrl);
        const items = response.data.items;

        console.log(`found ${items.length} items in bundle.`);

        // 2. Loop through each asset and download it
        for (const item of items) {
            if (item.type === 'Asset') {
                console.log(`📥 Downloading: ${item.name} (ID: ${item.id})`);
                
                const assetUrl = `https://assetdelivery.roblox.com/v1/asset/?id=${item.id}`;
                const assetData = await axios.get(assetUrl, { responseType: 'arraybuffer' });

                // 3. Save as .rbxm (Roblox Model Format)
                const safeName = item.name.replace(/[^a-z0-9]/gi, '_');
                fs.writeFileSync(`${safeName}.rbxm`, assetData.data);
            }
        }

        console.log("✅ All assets finished downloading.");
    } catch (error) {
        console.error("❌ API Error:", error.message);
        process.exit(1);
    }
}

downloadBundle();
