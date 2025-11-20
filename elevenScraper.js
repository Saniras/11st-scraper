// elevenScraper.js
const axios = require("axios");
const { XMLParser } = require("fast-xml-parser");
const iconv = require("iconv-lite");
const fs = require("fs");
const path = require("path");

const API_KEY = process.env.ELEVENST_API_KEY; // 🔴 GitHub Secrets에서 들어옴
const BASE_URL = "http://openapi.11st.co.kr/openapi/OpenApiService.tmall";

// 네가 정한 키워드 10개
const KEYWORDS = [
  "유산균",
  "비타민C 영양제",
  "톤업크림",
  "마스크팩",
  "진정크림",
  "콜라겐 나이트 마스크",
  "비건 스킨케어",
  "선크림",
  "탈모 샴푸",
  "브로우 젤"
];

const parser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true
});

async function search11st(keyword, page = 1, pageSize = 50) {
  if (!API_KEY) {
    throw new Error("ELEVENST_API_KEY 환경변수가 설정되어 있지 않습니다.");
  }

  const params = {
    key: API_KEY,
    apiCode: "ProductSearch",
    keyword,
    pageNum: String(page),
    pageSize: String(pageSize),
    sortCd: "CP" // 인기도순
  };

  const res = await axios.get(BASE_URL, {
    params,
    responseType: "arraybuffer" // EUC-KR 텍스트라서 버퍼로 받아야 함
  });

  // EUC-KR → UTF-8
  const decoded = iconv.decode(res.data, "euc-kr");
  const json = parser.parse(decoded);

  const root = json.ProductSearchResponse;
  if (!root || !root.Products) return [];

  let products = root.Products.Product || [];
  if (!Array.isArray(products)) {
    products = [products];
  }

  return products.map((p) => ({
    keyword_kr: keyword,
    product_code: p.ProductCode || null,
    name_kr: p.ProductName || null,
    price_krw: p.ProductPrice ? Number(p.ProductPrice) : null,
    sale_price_krw: p.SalePrice ? Number(p.SalePrice) : null,
    image_url: p.ProductImage || p.ImageUrl || null,
    detail_url: p.DetailPageUrl || p.ProductDetailUrl || null,
    seller: p.Seller || null,
    rating: p.Rating !== undefined ? Number(p.Rating) : null,
    review_count: p.ReviewCount !== undefined ? Number(p.ReviewCount) : null,
    buy_satisfy: p.BuySatisfy !== undefined ? Number(p.BuySatisfy) : null,
    source: "11st",
    scraped_at: new Date().toISOString()
  }));
}

async function run() {
  const all = [];

  for (const kw of KEYWORDS) {
    console.log(`🔎 11번가 검색: ${kw}`);
    try {
      const items = await search11st(kw, 1, 50); // 키워드당 최대 50개
      all.push(...items);
      // API 너무 두드리지 않게 대기
      await new Promise((r) => setTimeout(r, 1500));
    } catch (err) {
      console.error(`❌ ${kw} 검색 에러:`, err.message);
    }
  }

  const outDir = path.join(__dirname, "data");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outPath = path.join(outDir, "11st-products.json");
  fs.writeFileSync(outPath, JSON.stringify(all, null, 2), "utf-8");
  console.log(`✅ 총 ${all.length}개 상품 저장 완료: ${outPath}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
