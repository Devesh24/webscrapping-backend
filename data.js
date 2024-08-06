const router = require("express").Router();
const axios = require("axios");
const xml2js = require("xml2js");

const cheerio = require("cheerio");
const { convert } = require("html-to-text");
require("dotenv").config();
const Groq = require("groq-sdk");

const groqApiKey = process.env.GROQ_API_KEY;

const groq = new Groq({ apiKey: groqApiKey });

const fetchPageContent = async (url) => {
  try {
    const response = await axios.get(url);
    const html = response.data;
    const $ = cheerio.load(html);
    $("a, img, link, script, href").remove();
    const cleanedHtml = $.html();

    let textContent = convert(cleanedHtml, {
      wordwrap: 130,
    });

    if (textContent.length > 4000) {
      textContent = textContent.substring(0, 4000);
    }
    return textContent.replace(/\s+/g, " ").trim();
  } catch (error) {
    console.error("Error fetching the webpage:", error);
    return null;
  }
};

const generateSummary = async (pageContent) => {
  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: `give a short summary of the product in 3 very short bullet points without product name\n ${pageContent}`,
        },
      ],
      model: "llama3-70b-8192",
      temperature: 1,
      max_tokens: 6000,
      top_p: 1,
      stream: true,
      stop: null,
    });

    let summary = "";

    for await (const chunk of chatCompletion) {
      summary += chunk.choices[0]?.delta?.content || "";
    }

    return summary.trim();
  } catch (error) {
    console.error("Error generating summary:", error);
  }
};

router.get("/scrap-xml", async (req, res) => {
  try {
    const url = req.query.url;
    const XMLdata = await axios.get(url);
    xml2js.parseString(XMLdata.data, (err, result) => {
      if (err) {
        console.error("Error parsing XML:", err);
      } else {
        let i = 0;
        while(!('image:image' in result.urlset.url[i])) i++;
        res.status(200).json(result.urlset.url.slice(i, i+5));
      }
    });
  } catch (error) {
    console.log(error);
    res.status(500).json(error);
  }
});

router.get("/summarize", async (req, res) => {
  try {
    const url = req.query.url;
    const pageContent = await fetchPageContent(url);

    if (pageContent) {
      const summary = await generateSummary(pageContent);
      //   console.log("Summary:", summary);
      let summaryArray = summary ? summary.split("•") : [];
      summaryArray.shift();
      //   console.log(summaryArray);
      res.status(200).json(summaryArray);
    } else {
      console.log("Failed to fetch page content.");
    }
  } catch (error) {
    console.log(error);
    res.status(500).json(error);
  }
});

router.get("/get-sitemap", async (req, res) => {
  try {

    let url = req.query.domain
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = `https://${url}`;
    }
    const response = await axios.get(`${url}/robots.txt`);
    const robotsTxtContent = response.data;

    const lines = robotsTxtContent.split("\n");
    const sitemapUrl = lines
      .filter((line) => line.startsWith("Sitemap:"))[0]
      .replace("Sitemap:", "")
      .trim();
    // console.log(sitemapUrl);

    const XMLdata = await axios.get(sitemapUrl);
    xml2js.parseString(XMLdata.data, (err, result) => {
      if (err) {
        console.error("Error parsing XML:", err);
      } else {
        // console.log(result.sitemapindex.sitemap[0].loc[0]);
        res.status(200).json(result.sitemapindex.sitemap[0].loc[0]);
      }
    });
  } catch (error) {
    console.log(error);
    res.status(500).json(error);
  }
});
module.exports = router;
