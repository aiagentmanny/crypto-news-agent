import { HfInference } from "@huggingface/inference";
import * as dotenv from "dotenv";

dotenv.config({ path: "./.env" });

console.log("Hugging Face API Key:", process.env.HF_API_KEY ? "Loaded ✅" : "Not Found ❌");

const hf = new HfInference(process.env.HF_API_KEY as string);

async function generateNews(cryptoData: Record<string, any>) {
    const prompt = `Bitcoin is currently priced at $${cryptoData.bitcoin.usd}, while Ethereum is at $${cryptoData.ethereum.usd}. Write a short news update about the crypto market.`;

    console.log("Generated Prompt:", prompt);

    try {
        const response: any = await hf.textGeneration({
            model: "tiiuae/falcon-7b-instruct",
            inputs: prompt,
            parameters: { max_new_tokens: 100, temperature: 0.7 },
        });

        console.log("API Response:", response);

        if (response && response.generated_text) {
            let generatedNews = response.generated_text.trim().replace(/\n+/g, " "); // Remove unwanted newlines

            // ✅ Remove the prompt from the output
            if (generatedNews.startsWith(prompt)) {
                generatedNews = generatedNews.replace(prompt, "").trim();
            }

            // ✅ Extract Title & Description
            const sentences: string[] = generatedNews.split(". ").map((s: string) => s.trim());
            let title: string = sentences[0] ? sentences[0] + "." : "Crypto market update."; // First sentence as title
            let description: string = sentences.slice(1).join(". "); // Remaining text as description

            // ✅ Ensure the description is complete
            if (!description.endsWith(".")) {
                description += "..."; // Add "..." only if it's cut off
            }

            console.log("\n📰 Generated News:");
            console.log(`Title: ${title}`);
            console.log(`Description: ${description}`);

            return { title, description };
        } else {
            throw new Error("Unexpected response format from Hugging Face API.");
        }
    } catch (error) {
        console.error("Error generating news:", error);
    }
}

// Example usage
generateNews({ bitcoin: { usd: 86275 }, ethereum: { usd: 2224.88 } });
