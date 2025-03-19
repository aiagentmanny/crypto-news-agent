import { HfInference } from "@huggingface/inference";
import axios from "axios";
import * as dotenv from "dotenv";
import * as cron from "node-cron";
import { TwitterApi } from "twitter-api-v2";
import { exec } from "child_process";
import * as fs from "fs"; // ✅ FIXED IMPORT


dotenv.config({ path: "./.env" });

// 🔑 Load environment variables
const HF_API_KEY = process.env.HF_API_KEY || "";
const JWT_TOKEN = process.env.JWT_TOKEN || "";
const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY || "";
const WORDPRESS_URL = "https://connectivebrand.com/wp-json/wp/v2/posts";
const TWITTER_API_KEY = process.env.TWITTER_API_KEY;
const TWITTER_API_SECRET = process.env.TWITTER_API_SECRET;
const TWITTER_ACCESS_TOKEN = process.env.TWITTER_ACCESS_TOKEN;
const TWITTER_ACCESS_SECRET = process.env.TWITTER_ACCESS_SECRET;

if (!HF_API_KEY || !JWT_TOKEN || !COINMARKETCAP_API_KEY || !TWITTER_API_KEY || !TWITTER_API_SECRET || !TWITTER_ACCESS_TOKEN || !TWITTER_ACCESS_SECRET) {
    console.error("❌ Missing one or more environment variables. Please check your .env file.");
    process.exit(1);
}

// 🐦 Twitter API Setup
const twitterClient = new TwitterApi({
    appKey: TWITTER_API_KEY,
    appSecret: TWITTER_API_SECRET,
    accessToken: TWITTER_ACCESS_TOKEN,
    accessSecret: TWITTER_ACCESS_SECRET,
});
const rwClient = twitterClient.readWrite;

// 📊 Fetch latest crypto data
async function fetchCryptoNews() {
    try {
        console.log("🔍 Fetching crypto news...");
        const response = await axios.get("https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest", {
            headers: { "X-CMC_PRO_API_KEY": COINMARKETCAP_API_KEY },
            params: { limit: 5, convert: "USD" }
        });

        return response.data.data.map((item: any) => ({
            title: `🚀 ${item.name} Update: ${item.quote.USD.percent_change_24h.toFixed(2)}% Change!`,
            description: `💰 ${item.name} is now trading at $${item.quote.USD.price.toFixed(2)}. Over the past 24 hours, it has seen a ${item.quote.USD.percent_change_24h.toFixed(2)}% change. Stay updated with the latest market trends!`
        }));
    } catch (error) {
        console.error("❌ Error fetching crypto news:", (error as Error).message);
        return null;
    }
}

// 📝 Generate news using Falcon-7B
async function generateNews(newsHeadlines: any) {
    try {
        console.log("🧠 Generating AI news...");
        const client = new HfInference(HF_API_KEY);
        const prompt = `
            The latest cryptocurrency market trends:
            ${newsHeadlines.map((item: any) => `- ${item.title}: ${item.description}`).join("\n")}
            Summarize these trends in a unique, concise, and engaging way.
        `;

        const response = await client.textGeneration({
            model: "tiiuae/falcon-7b-instruct",
            inputs: prompt,
            parameters: { max_new_tokens: 250, temperature: 0.8 }
        });

        return response.generated_text?.trim() || "";
    } catch (error) {
        console.error("❌ Error generating news:", (error as Error).message);
        return null;
    }
}

// Run generateimage.ts and capture the generated image URL
async function generateImage(): Promise<string> {
    return new Promise((resolve) => {
        console.log("🎨 Generating AI image with ts-node...");

        exec("ts-node generateimage.ts", (error, stdout) => {
            if (error) {
                console.error("❌ Error generating image:", error.message);
                resolve(""); // Continue without an image
                return;
            }

            const imageUrl = stdout.trim();
            if (!imageUrl) {
                console.warn("⚠️ No image URL found in output.");
            } else {
                console.log("✅ Image URL received:", imageUrl);
            }
            resolve(imageUrl); // Return the image URL (or empty string if failed)
        });
    });
}


// 📝 Publish news to WordPress
async function publishToWordPress(content: string, imageUrl: string) {
    try {
        console.log("📢 Publishing to WordPress...");
        const postData = {
            title: `🔵 Crypto Update: ${new Date().toLocaleDateString()}`,
            content: imageUrl ? `<img src='${imageUrl}' alt='Crypto Image'/><br/>${content}` : content,
            status: "publish"
        };

        const response = await axios.post(WORDPRESS_URL, postData, {
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${JWT_TOKEN}` }
        });

        console.log("✅ News published to WordPress:", response.data.link);
        return response.data.link;
    } catch (error) {
        console.error("❌ Error publishing to WordPress:", (error as Error).message);
        return null;
    }
}

// 🐦 Post news to Twitter
async function postToTwitter(content: string, imageUrl: string, wordpressLink: string) {
    try {
        console.log("🐦 Posting to Twitter...");
        const tweet = `${content.slice(0, 200)}...\nRead more: ${wordpressLink}`;
        await rwClient.v2.tweet(tweet);
        console.log("✅ News posted to Twitter!");
    } catch (error) {
        console.error("❌ Error posting to Twitter:", (error as Error).message);
    }
}

// 🚀 Main function to fetch, generate, and post content
async function main() {
    console.log("🚀 Running Crypto News Publisher...");
    const newsHeadlines = await fetchCryptoNews();
    if (!newsHeadlines) {
        console.error("⚠️ Skipping due to news fetch failure.");
        return;
    }

    const news = await generateNews(newsHeadlines);
    if (!news) {
        console.error("⚠️ Skipping due to news generation failure.");
        return;
    }

    console.log("🎨 Requesting AI image...");
    const imageUrl = await generateImage(); // Uses ts-node to generate the image separately

    if (!imageUrl) {
        console.warn("⚠️ No image generated, but continuing...");
    }

    const wordpressLink = await publishToWordPress(news, imageUrl);
    if (!wordpressLink) {
        console.error("⚠️ Skipping Twitter post due to WordPress failure.");
        return;
    }

    await postToTwitter(news, imageUrl, wordpressLink);
}

// ⏳ Schedule task every 4 hours
cron.schedule("0 */4 * * *", async () => {
    console.log("⏳ Scheduled task running...");
    await main();
});

// ▶ Run script immediately
main().catch(error => console.error("❌ Unexpected error:", (error as Error).message));
