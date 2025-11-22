import { TwitterApi } from "twitter-api-v2";
import axios from "axios";
import pg from "pg";

const { Client } = pg;

export default async function handler(req, res) {
  const clientDB = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  await clientDB.connect();

  try {
    const client = new TwitterApi({
      appKey: process.env.API_KEY,
      appSecret: process.env.API_SECRET,
      accessToken: process.env.ACCESS_TOKEN,
      accessSecret: process.env.ACCESS_SECRET,
    });

    const rwClient = client;

    const emojis = ["🚀", "✨", "😊", "😉", "🔥", "💡", "🙌"];
    const hashtags =
      "#zonauang #joki #flutter #kotlin #android #IT #skripsiIT #jasacoding #jasaflutter #jasajoki #androidstudio #jasaskripsi #jasabackend";

    const hashtagLength = hashtags.length + 2;
    const TWITTER_LIMIT = 280;
    const maxCaptionLength = TWITTER_LIMIT - hashtagLength;

    const fallbackTexts = [
      "Butuh bantuan coding cepat & rapi? Terima joki coding kuliah / freelance.",
      "Deadline mepet? Tenang, kita siap bantu joki coding & skripsi IT.",
      "Lagi stuck coding? Yuk ngobrol dulu, konsultasi gratis.",
      "Mau bikin aplikasi Android / Flutter? Ceritakan idemu dulu yuk.",
      "Tugas ngoding bikin pusing? Santai, kita bantu beresin.",
      "Debug error bikin stress? Kirim screenshot, kita bantu.",
      "Mau hasil rapi dan deadline aman? Hubungi aja dulu.",
      "Kesulitan project? Bisa revisi saja atau full build.",
      "Lagi bingung mulai dari mana? Sini bimbing dari awal.",
      "Butuh partner coding yang fast response dan ramah?",
    ];

    const getFallbackMessage = () =>
      fallbackTexts[Math.floor(Math.random() * fallbackTexts.length)];

    // === AI CAPTION ===
    async function generateCaption() {
      try {
        const prompt = `Buatkan caption promosi jasa coding yang friendly dan menarik. Gunakan 1 emoji di awal atau di akhir saja. Maksimal ${maxCaptionLength} karakter. Tanpa hashtag. Output hanya kalimat caption saja.`;

        const response = await axios.post(
          "https://inference.jatevo.id/v1/chat/completions",
          {
            model: "deepseek-ai/DeepSeek-V3-0324",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 200,
            temperature: 0.9,
            stream: false,
          },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.JATEVO_KEY}`,
            },
          }
        );

        let caption = response.data?.choices?.[0]?.message?.content?.trim();
        if (!caption) return null;

        if (caption.length > maxCaptionLength) {
          caption = caption.substring(0, maxCaptionLength - 3) + "...";
        }

        return caption;
      } catch (error) {
        if (error?.response?.status === 429) {
          console.log("JATEVO 429 — switching to fallback");
          return null;
        }
        console.error("JATEVO ERROR FULL:", error?.response?.data || error.message);
        return null;
      }
    }

    // === GET LAST TWEET ===
    const lastTweet = await clientDB.query(
      "SELECT message FROM tweet_log ORDER BY id DESC LIMIT 1"
    );

    // === GENERATE CAPTION & FALLBACK ===
    let caption = await generateCaption();
    if (!caption) {
      console.log("AI failed — using fallback...");
      let attempts = 0;
      do {
        caption = getFallbackMessage();
        attempts++;
      } while (
        `${caption}\n\n${hashtags}` === lastTweet.rows[0]?.message &&
        attempts < 10
      );
    }

    // === EMOJI RANDOM ===
    const emoji = emojis[Math.floor(Math.random() * emojis.length)];
    caption = Math.random() < 0.5 ? `${emoji} ${caption}` : `${caption} ${emoji}`;

    const finalText = `${caption}\n\n${hashtags}`;

    // === DUPLICATE DETECTION ===
    if (lastTweet.rows[0]?.message === finalText) {
      return res.status(200).json({ skip: true, reason: "duplicate tweet" });
    }

    // === UPLOAD IMAGE WITH 429 HANDLE ===
    let mediaId = null;
    try {
      const imageResponse = await axios.get(
        "https://auto.santanadev.my.id/images/foto1.jpg",
        { responseType: "arraybuffer" }
      );
      const imageBuffer = Buffer.from(imageResponse.data);
      mediaId = await rwClient.v1.uploadMedia(imageBuffer, { type: "jpg" });
    } catch (err) {
      if (err?.response?.status === 429) {
        console.log("TWITTER 429 — skipping image upload");
      } else {
        console.error("UPLOAD ERROR DETAILS:", err?.response?.data || err.message);
      }
    }

    // === SEND TWEET ===
    let tweet1;
    try {
      tweet1 = await rwClient.v2.tweet(
        mediaId
          ? { text: finalText, media: { media_ids: [mediaId] } }
          : { text: finalText }
      );
    } catch (err) {
      console.error("TWITTER POST ERROR FULL:", err?.response?.data || err.message);

      if (err?.response?.status === 429) {
        return res.status(200).json({
          fallback: true,
          source: "Twitter Tweet Limit",
          error: err?.response?.data,
        });
      }

      throw err;
    }

    // === THREAD SECOND TWEET ===
    const threadMessage =
      "Jasa Joki Tugas IT (Flutter Android, Kotlin, Laravel, JS)\n" +
      "WA Fast Response: wa.me/6281223226212\n" +
      "Testimoni: https://s.id/testikael\n" +
      "Website: https://santanadev.my.id";

    await rwClient.v2.reply(threadMessage, tweet1.data.id);

    // === SAVE DB ===
    await clientDB.query("INSERT INTO tweet_log (message) VALUES ($1)", [
      finalText,
    ]);

    return res.status(200).json({ success: true, tweet: finalText });

  } catch (err) {
    console.error("FINAL ERROR FULL:", err?.response?.data || err);
    return res.status(200).json({
      error: err?.response?.data || err?.data || err?.message,
      status: err?.response?.status,
      source: err?.response?.headers?.["x-rate-limit-limit"]
        ? "TWITTER"
        : "JATEVO / OTHER",
      headers: err?.response?.headers ?? null,
    });
  } finally {
    clientDB.end();
  }
}
