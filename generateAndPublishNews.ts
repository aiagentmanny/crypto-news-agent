import { HfInference } from "@huggingface/inference";
import axios from "axios";
import * as dotenv from "dotenv";
import * as cron from "node-cron";
import { TwitterApi } from "twitter-api-v2";

dotenv.config({ path: "./.env" });

// Load environment variables
const HF_API_KEY = process.env.HF_API_KEY || "";
const JWT_TOKEN = process.env.JWT_TOKEN || "";
const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY || "";
const WORDPRESS_URL = "https://connectivebrand.com/wp-json/wp/v2/posts";

// Twitter API Keys
const twitterClient = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY!,
    appSecret: process.env.TWITTER_API_SECRET!,
    accessToken: process.env.TWITTER_ACCESS_TOKEN!,
    accessSecret: process.env.TWITTER_ACCESS_SECRET!,
});

const rwClient = twitterClient.readWrite; // Ensures we can post tweets

// ✅ Fetch crypto news from CoinMarketCap
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
    } catch (error) {
        console.error("❌ Error fetching crypto news:", error);
        return null;
    }
}

// ✅ Generate unique title
function generateUniqueTitle() {
    const titles = [
        "Today's Cryptocurrency Insights",
        "Key Crypto Market Movements",
        "Crypto Market Overview",
        "Daily Digital Asset Update",
        "Breaking News in Crypto"
    ];
    return titles[Math.floor(Math.random() * titles.length)];
}

// ✅ Generate news summary using Falcon-7B
async function generateNews(newsHeadlines: any) {
    try {
        if (!HF_API_KEY) throw new Error("Missing Hugging Face API Key");

        const client = new HfInference(HF_API_KEY);
        const prompt = `
            The latest cryptocurrency market trends:
            ${newsHeadlines.map((item: any) => `- ${item.title}: ${item.description}`).join("\n")}
            
            Summarize these trends in a unique, concise, and engaging way.
            Avoid repeating exact price changes. Focus on major trends and what they mean for investors.
        `;

        const response = await client.textGeneration({
            model: "tiiuae/falcon-7b-instruct",
            inputs: prompt,
            parameters: { max_new_tokens: 250, temperature: 0.8 }
        });

        const newsContent = response.generated_text?.trim() || "";
        console.log("✅ Generated News:", newsContent);
        return newsContent;
    } catch (error) {
        console.error("❌ Error generating news:", error);
        return null;
    }
}

// ✅ Publish news to WordPress
async function publishToWordPress(content: string) {
    try {
        if (!JWT_TOKEN) throw new Error("Missing JWT Token or token expired. Generate a new one.");

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
        return response.data.link;
    } catch (error: any) {
        console.error("❌ Error publishing to WordPress:", error.response?.data || error.message);
        return null;
    }
}

// ✅ Post to Twitter (Fixed Authentication)
async function postToTwitter(newsContent: string, wordpressLink: string | null) {
    try {
        let tweetContent = `${generateUniqueTitle()} 📢\n\n${newsContent.substring(0, 200)}...`;
        if (wordpressLink) {
            tweetContent += `\nRead more: ${wordpressLink}`;
        }

        // Use the correct method to post the tweet
        const tweet = await rwClient.v2.tweet(tweetContent);

        console.log("✅ Successfully posted on Twitter:", `https://twitter.com/user/status/${tweet.data.id}`);
    } catch (error: any) {
        console.error("❌ Error posting to Twitter:", error.data || error.message);
    }
}

// ✅ Schedule script to run every 4 hours
cron.schedule("0 */4 * * *", async () => {
    console.log("⏳ Scheduled task running...");
    await main();
});

// ✅ Main function
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

    const wordpressLink = await publishToWordPress(news);
    await postToTwitter(news, wordpressLink);
}

main().catch((error) => {
    console.error("❌ Unexpected error in script:", error);
});
