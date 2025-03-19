import axios from "axios";
import * as dotenv from "dotenv";

dotenv.config();

const STARRYAI_API_KEY = process.env.STARRYAI_API_KEY;
const IMAGE_PROMPT = "Futuristic crypto coin visualization";

if (!STARRYAI_API_KEY) {
    console.error("❌ Missing API Key! Please check your .env file.");
    process.exit(1);
}

async function generateImage(prompt: string) {
    try {
        console.log("🎨 Sending request to StarryAI...");
        
        const response = await axios.post("https://api.starryai.com/creations", {
            prompt,
            width: 512,
            height: 512
        }, {
            headers: { 
                "X-API-Key": STARRYAI_API_KEY, 
                "Content-Type": "application/json" 
            }
        });

        console.log("🖼️ Full API Response:", JSON.stringify(response.data, null, 2)); // Debugging log

        if (!Array.isArray(response.data) || response.data.length === 0) {
            console.error("❌ No valid images found in the API response.");
            return "";
        }

        // Find the latest valid image
        const latestImage = response.data.find(item => item.images && !item.expired);
        
        if (!latestImage || !latestImage.images || latestImage.images.length === 0) {
            console.error("❌ Image request failed, no valid images available.");
            return "";
        }

        const imageUrl = latestImage.images[0].url;
        console.log("✅ Image generated:", imageUrl);
        return imageUrl;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error("❌ Axios error:", error.response?.data || error.message);
        } else {
            console.error("❌ Unknown error:", error);
        }
        return "";
    }
}

// Run the function for testing
generateImage(IMAGE_PROMPT);
