import { TwitterApi } from "twitter-api-v2";
import axios from "axios";

export default async function handler(req, res) {
  try {
    const client = new TwitterApi({
      appKey: process.env.API_KEY,
      appSecret: process.env.API_SECRET,
      accessToken: process.env.ACCESS_TOKEN,
      accessSecret: process.env.ACCESS_SECRET,
    });

    const rwClient = client;

    const hashtags =
      "#zonauang #joki #flutter #kotlin #android #IT #skripsiIT #jasacoding #jasaflutter #jasajoki #androidstudio #jasaskripsi #jasabackend";

    const hashtagLength = hashtags.length + 2;
    const TWITTER_LIMIT = 280;
    const maxCaptionLength = TWITTER_LIMIT - hashtagLength;

    const fallbackTexts = [
      "✨ Butuh bantuan coding cepat & rapi? Terima joki coding: Flutter, Kotlin, Android, API, UI atau task kampus? DM skrg yuk. Konsul GRATIS 🚀",
      "🔥 Deadline mepet? Tenang, kita siap bantu joki coding & skripsi IT. DM aja dulu, fast response ✨",
      "🚀 Mau aplikasi Android / Flutter? Atau lagi stuck skripsi? Yuk ngobrol dulu, konsul gratis 🧠💡",
    ];

    const getFallbackMessage = () =>
      fallbackTexts[Math.floor(Math.random() * fallbackTexts.length)];

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

        let caption = response.data.choices[0].message.content.trim();
        caption = caption.replace(/\(\d+ karakter\)/gi, "").trim();

        if (caption.length > maxCaptionLength) {
          caption = caption.substring(0, maxCaptionLength - 3) + "...";
        }

        return caption;
      } catch {
        return null;
      }
    }

    const caption = (await generateCaption()) ?? getFallbackMessage();
    const finalText = `${caption}\n\n${hashtags}`;

    const mediaId = await rwClient.v1.uploadMedia("../images/foto1.jpg");
    await rwClient.v2.tweet({
      text: finalText,
      media: { media_ids: [mediaId] },
    });

    return res.status(200).json({ success: true, tweet: finalText });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
