import axios from "axios";

async function fetchCryptoData() {
    try {
        const response = await axios.get(
            "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd"
        );
        console.log("Crypto Data:", response.data);  // This should log the output
    } catch (error) {
        console.error("Error fetching crypto data:", error);
    }
}

// Call the function
fetchCryptoData();
