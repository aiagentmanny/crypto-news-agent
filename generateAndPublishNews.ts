import { HfInference } from "@huggingface/inference";
import axios from "axios";
import * as dotenv from "dotenv";
import * as cron from "node-cron";

dotenv.config({ path: "./.env" });

// Load environment variables
const HF_API_KEY = process.env.HF_API_KEY || "";
const JWT_TOKEN = process.env.JWT_TOKEN || "";
const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY || "";
const WORDPRESS_URL = "https://connectivebrand.com/wp-json/wp/v2/posts"; // Replace with your WordPress URL

// Function to fetch crypto news from CoinMarketCap
async function fetchCryptoNews() {
    try {
        const response = await axios.get("https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest", {
            headers: { "X-CMC_PRO_API_KEY": COINMARKETCAP_API_KEY },
            params: { limit: 5, convert: "USD" }
        });

        console.log("✅ Fetched Crypto Market News:", response.data);
        return response.data.data.map((item: any) => ({ 
            title: item.name, 
            description: `${item.quote.USD.percent_change_24h.toFixed(2)}% change in 24h, Current price: $${item.quote.USD.price.toFixed(2)}` 
        }));
    } catch (error: unknown) {
        console.error("❌ Error fetching crypto news:", error instanceof Error ? error.message : "Unknown error");
        return null;
    }
}

// Function to generate a unique title
function generateUniqueTitle() {
    const titles = [
        "Today's Cryptocurrency Insights",
        "Key Crypto Market Movements",
        "Crypto Market Overview",
        "Daily Digital Asset Update",
        "Breaking News in Crypto",
        "Latest Crypto Developments",
        "Trending Cryptocurrency Reports",
        "Crypto Industry Roundup",
        "What’s Happening in Crypto?",
        "Essential Crypto Market News"
    ];
    return titles[Math.floor(Math.random() * titles.length)];
}

// Function to generate news summary using Falcon-7B
async function generateNews(newsHeadlines: any) {
    try {
        if (!HF_API_KEY) {
            throw new Error("Missing Hugging Face API Key");
        }

        const client = new HfInference(HF_API_KEY);
        const prompt = `
            The latest cryptocurrency market update:
            ${newsHeadlines.map((item: any) => `- ${item.title}: ${item.description}`).join("\n")}
            Provide a compelling, concise, and informative summary of these market movements. Avoid repetition and do not give financial advice.
        `;

        const response = await client.textGeneration({
            model: "tiiuae/falcon-7b-instruct",
            inputs: prompt,
            parameters: { max_new_tokens: 250, temperature: 0.8 }
        });

        const newsContent = response.generated_text?.trim() || "";
        console.log("✅ Generated News:", newsContent);
        return newsContent;
    } catch (error: unknown) {
        console.error("❌ Error generating news:", error instanceof Error ? error.message : "Unknown error");
        return null;
    }
}

// Function to publish news to WordPress
async function publishToWordPress(content: string) {
    try {
        if (!JWT_TOKEN) {
            throw new Error("Missing JWT Token");
        }

        const postData = {
            title: generateUniqueTitle(),
            content: content,
            status: "publish"
        };

        const response = await axios.post(WORDPRESS_URL, postData, {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${JWT_TOKEN}`
            }
        });

        console.log("✅ Successfully published to WordPress:", response.data.link);
    } catch (error: unknown) {
        console.error("❌ Error publishing to WordPress:", error instanceof Error ? error.message : "Unknown error");
    }
}

// Schedule the script to run 4-5 times a day
cron.schedule("0 */5 * * *", async () => {
    console.log("⏳ Scheduled task running...");
    await main();
});

// Main function
async function main() {
    console.log("🚀 Running Automated Crypto News Publisher...");

    const newsHeadlines = await fetchCryptoNews();
    if (!newsHeadlines) {
        console.error("❌ Failed to fetch crypto news. Exiting...");
        return;
    }

    const news = await generateNews(newsHeadlines);
    if (!news) {
        console.error("❌ Failed to generate news. Exiting...");
        return;
    }

    await publishToWordPress(news);
}

main().catch((error) => {
    console.error("❌ Unexpected error in script:", error instanceof Error ? error.message : "Unknown error");
});
