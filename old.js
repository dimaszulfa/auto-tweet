import { TwitterApi } from "twitter-api-v2";
import dotenv from "dotenv";
import axios from "axios";
dotenv.config();

const client = new TwitterApi({
  appKey: process.env.API_KEY,
  appSecret: process.env.API_SECRET,
  accessToken: process.env.ACCESS_TOKEN,
  accessSecret: process.env.ACCESS_SECRET,
});

// Tidak perlu readWrite()
const rwClient = client;

const hashtags =
  "#zonauang #joki #flutter #kotlin #android #IT #skripsiIT #jasacoding #jasaflutter #jasajoki #androidstudio #jasaskripsi #jasabackend";

// Ambil panjang hashtag + enter double (\n\n)
const hashtagLength = hashtags.length + 2; 
const TWITTER_LIMIT = 280;
const maxCaptionLength = TWITTER_LIMIT - hashtagLength;

// Fallback caption random jika Jatevo error
const fallbackTexts = [
  "✨ Butuh bantuan coding cepat & rapi? Terima joki coding: Flutter, Kotlin, Android, API, UI atau task kampus? DM skrg yuk. Konsul GRATIS 🚀",
  "🔥 Deadline mepet? Tenang, kita siap bantu joki coding & skripsi IT. DM aja dulu, fast response ✨",
  "🚀 Mau aplikasi Android / Flutter? Atau lagi stuck skripsi? Yuk ngobrol dulu, konsul gratis 🧠💡",
];

function getFallbackMessage() {
  return fallbackTexts[Math.floor(Math.random() * fallbackTexts.length)];
}

// Generate caption dari Jatevo
async function generateCaption() {
  try {
    const prompt = `Buatkan caption promosi jasa coding yang friendly dan menarik. Gunakan 1 emoji di awal atau di akhir saja. Maksimal ${maxCaptionLength} karakter. Tanpa hashtag. Output hanya kalimat caption saja, tanpa penjelasan tambahan, tanpa informasi jumlah karakter.`;

    const response = await axios.post(
      "https://inference.jatevo.id/v1/chat/completions",
      {
        model: "deepseek-ai/DeepSeek-V3-0324",
        messages: [{ role: "user", content: prompt }],
        stream: false,
        temperature: 0.9,
        max_tokens: 200,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.JATEVO_KEY}`,
        },
      }
    );

    let caption = response.data.choices?.[0]?.message?.content?.trim();
	caption = caption.replace(/\(\d+ karakter\)/gi, "").trim();

    // Safety trimming if still longer
    if (caption && caption.length > maxCaptionLength) {
      caption = caption.substring(0, maxCaptionLength - 3) + "...";
    }

    return caption;
  } catch (error) {
    console.log("⚠️ Jatevo error, gunakan fallback caption.");
    return null;
  }
}

// Gabungkan caption + hashtag
async function buildTweetText() {
  const caption = await generateCaption();
  const text = caption ?? getFallbackMessage();
  return `${text}\n\n${hashtags}`;
}

// Kirim tweet dengan gambar
async function tweetWithImage() {
  try {
    const mediaId = await rwClient.v1.uploadMedia("./images/foto1.jpg");
    const tweetText = await buildTweetText();

    console.log("📝 Tweet siap kirim:");
    console.log(tweetText);
    console.log("Total length:", tweetText.length);

    const tweet = await rwClient.v2.tweet({
      text: tweetText,
      media: { media_ids: [mediaId] },
    });

    console.log("Tweet berhasil terkirim:", tweet);
  } catch (error) {
    console.error("❌ Gagal kirim tweet:", error);
  }
}

tweetWithImage();
