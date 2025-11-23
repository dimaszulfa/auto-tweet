import { TwitterApi } from "twitter-api-v2";
import axios from "axios";
import pg from "pg";

const { Client } = pg;

export default async function handler(req, res) {
  const clientDB = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
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

async function generateCaption(lastText) {
  try {
    const prompt = `
Buatkan caption promosi jasa coding yang friendly, menarik, dan unik. 
Gunakan hanya 1 emoji di awal atau akhir. Maksimal ${maxCaptionLength} karakter. Tanpa hashtag.

PERATURAN PENTING:
- Jangan gunakan kalimat yang mirip atau sama dengan contoh sebelumnya.
- Jangan pakai frasa, susunan kata, atau gaya penulisan yang mirip dengan caption ini:
"${lastText}"

Output hanya isi caption, tanpa tambahan catatan atau karakter lain.
`;

    const response = await axios.post(
      "https://inference.jatevo.id/v1/chat/completions",
      {
        model: "deepseek-ai/DeepSeek-V3-0324",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 200,
        temperature: 1.0,
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
  } catch (err) {
    return null;
  }
}


    const lastTweet = await clientDB.query(
      "SELECT message FROM tweet_log ORDER BY id DESC LIMIT 1"
    );

	let caption = await generateCaption(lastTweet.rows[0]?.message || "");
    if (!caption) {
      let attempts = 0;
      do {
        caption = getFallbackMessage();
        attempts++;
      } while (`${caption}\n\n${hashtags}` === lastTweet.rows[0]?.message && attempts < 10);
    }

    const emoji = emojis[Math.floor(Math.random() * emojis.length)];

    // CLEAN TEXT (tanpa emoji)
    const cleanText = `${caption}\n\n${hashtags}`;

    // FINAL TEXT (emoji ditambahkan untuk dipost)
    const finalText =
      Math.random() < 0.5
        ? `${emoji} ${caption}\n\n${hashtags}`
        : `${caption} ${emoji}\n\n${hashtags}`;

    // === DUPLICATE DETECTION (bandingkan versi tanpa emoji)
    if (lastTweet.rows[0]?.message === cleanText) {
      return res.status(200).json({ skip: true, reason: "duplicate tweet" });
    }

    let mediaId = null;
    const imageResponse = await axios.get(
      "https://auto.santanadev.my.id/images/foto1.jpg",
      { responseType: "arraybuffer" }
    );
    const imageBuffer = Buffer.from(imageResponse.data);
    mediaId = await rwClient.v1.uploadMedia(imageBuffer, { type: "jpg" });

    const tweet1 = await rwClient.v2.tweet({
      text: finalText,
      media: { media_ids: [mediaId] },
    });

    const threadMessage =
      "Jasa Joki Tugas IT (Flutter Android, Kotlin, Laravel, JS)\n" +
      "WA Fast Response: wa.me/6281223226212\n" +
      "Testimoni: https://s.id/testikael\n" +
      "Website: https://santanadev.my.id";

    await rwClient.v2.reply(threadMessage, tweet1.data.id);

    // SAVE ONLY CLEAN TEXT WITHOUT EMOJI
    await clientDB.query("INSERT INTO tweet_log (message) VALUES ($1)", [
      cleanText,
    ]);

    return res.status(200).json({ success: true, tweet: finalText });
  } catch (err) {
    return res.status(200).json({ error: err.message });
  } finally {
    clientDB.end();
  }
}
