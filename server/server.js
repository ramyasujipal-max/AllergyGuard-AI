// server/server.js
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';

const app = express();
app.use(express.json());
app.use(cors({ origin: ['http://localhost:3000', 'http://localhost:5173'] }));

const USDA_KEY = process.env.USDA_API_KEY;
const API = 'https://api.nal.usda.gov/fdc/v1';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// --- Simple cache ---
const cache = new Map();
const get = k => {
  const v = cache.get(k);
  if (!v) return null;
  if (Date.now() - v.t > 5 * 60 * 1000) {
    cache.delete(k);
    return null;
  }
  return v.data;
};
const set = (k, data) => cache.set(k, { data, t: Date.now() });

function num(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}
function fromLabel(ln = {}) {
  return {
    calories: num(ln.calories?.value),
    carbs: num(ln.carbohydrates?.value),
    sugars: num(ln.sugars?.value)
  };
}
function fromNutrients(list = []) {
  const find = code =>
    list.find(n => String(n?.nutrient?.number) === String(code))?.amount;
  return {
    calories: num(find(1008)),
    carbs: num(find(1005)),
    sugars: num(find(2000))
  };
}

// --- USDA Nutrition route ---
app.post('/nutrition', async (req, res) => {
  try {
    if (!USDA_KEY)
      return res.status(500).json({ error: 'USDA_API_KEY missing in .env' });

    const name = (req.body?.name || '').trim();
    const brand = (req.body?.brand || '').trim();
    if (!name) return res.status(400).json({ error: 'name required' });

    const q = [brand, name].filter(Boolean).join(' ').trim() || name;
    const cacheKey = `USDA::${q.toLowerCase()}`;
    const cached = get(cacheKey);
    if (cached) return res.json(cached);

    const s = await fetch(
      `${API}/foods/search?query=${encodeURIComponent(
        q
      )}&pageSize=5&api_key=${USDA_KEY}`
    );
    if (!s.ok) throw new Error('search_failed');
    const sj = await s.json();
    const hits = Array.isArray(sj.foods) ? sj.foods : [];
    if (!hits.length) return res.status(404).json({ error: 'not_found' });

    const pick =
      (brand ? hits.find(h => h.dataType === 'Branded') : null) || hits[0];

    const d = await (
      await fetch(`${API}/food/${pick.fdcId}?api_key=${USDA_KEY}`)
    ).json();
    const nutrients = d.labelNutrients
      ? fromLabel(d.labelNutrients)
      : fromNutrients(d.foodNutrients);

    const out = {
      source: 'usda',
      matchType: brand
        ? (d.brandOwner || '')
            .toLowerCase()
            .includes(brand.toLowerCase())
          ? 'exact'
          : 'likely'
        : 'generic',
      serving_desc:
        d.householdServingFullText ||
        (d.servingSize && d.servingSizeUnit
          ? `${d.servingSize} ${d.servingSizeUnit}`
          : '100 g'),
      calories_kcal: Math.round(nutrients.calories || 0),
      carbs_g: Math.round(nutrients.carbs || 0),
      sugar_g: Math.round(nutrients.sugars || 0),
      raw_name: d.description || pick.description || ''
    };

    set(cacheKey, out);
    res.json(out);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error' });
  }
});

// --- Ask AI route ---
// --- Ask AI route (Responses API, uses `input` instead of `messages`) ---
app.post('/ask', async (req, res) => {
  try {
	  const fakeResponse = [
      "• Contains barley malt and gluten — potential allergen risk.",
      "• Moderate carbohydrate content (29g) per serving.",
      "• Low sugar content (4g) compared to carbs.",
      "• Suitable for occasional consumption if not sensitive to gluten.",
      "Verdict: Limit"
    ].join("\n");
	 return res.json({ ok: true, text: fakeResponse });
	 /*
    const { product, nutrition, profile, isDiabetic } = req.body || {};

    const selectedAllergens = Object.entries(profile || {})
      .filter(([, on]) => !!on)
      .map(([k]) => k.replace(/_/g, ' '));

    const prompt =
				`You are AllergyGuard AI, a concise grocery safety assistant.
				Write 3–6 short bullets. If diabetic mode is on, consider BOTH carbs and sugar.
				Highlight potential allergen hits from the user's selected list.
				Finish with one verdict: Eat / Limit / Avoid. General guidance only; not medical advice.

				Product: ${product?.product_name || '(unknown)'} by ${product?.brands || '(brand n/a)'}
				Ingredients: ${product?.ingredients_text || 'n/a'}
				Allergen tags (product): ${(product?.allergens_tags || []).join(', ') || 'none'}
				User-selected allergens: ${selectedAllergens.join(', ') || 'none'}
			${nutrition
			  ? `Nutrition per serving: calories=${Math.round(nutrition.calories_kcal)} kcal, carbs=${Math.round(nutrition.carbs_g)} g, sugar=${Math.round(nutrition.sugar_g)} g, serving="${nutrition.serving_desc}"`
			  : 'Nutrition: unavailable'}
			Diabetic mode: ${isDiabetic ? 'ON' : 'OFF'}`;

    const r = await openai.responses.create({
      model: 'gpt-4o-mini',         // keep or change to a model you have access to
      input: prompt,                // ✅ Responses API uses `input`
      max_output_tokens: 300,
    });

    const text = r.output_text || 'Sorry, I could not generate a summary.';
    return res.json({ ok: true, text }); */
  } catch (err) {
    console.error('[ASK][ERROR]', err);
    const status = err?.status || 500;
    return res.status(status).json({
      ok: false,
      error: err?.message || 'AI request failed',
      code: err?.code,
      type: err?.type,
      status,
    });
  }
});


const PORT = process.env.PORT || 3001;
app.listen(PORT, () =>
  console.log(`Nutrition API (USDA) + AI on http://localhost:${PORT}`)
);
