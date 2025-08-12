// server/server.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
app.use(express.json());

// allow your frontend origin(s)
app.use(cors({ origin: ['http://localhost:3000','http://localhost:5173'] }));

const USDA_KEY = process.env.USDA_API_KEY;
const API = 'https://api.nal.usda.gov/fdc/v1';

// simple 5-min cache
const cache = new Map();
const get = k => {
  const v = cache.get(k);
  if (!v) return null;
  if (Date.now() - v.t > 5 * 60 * 1000) { cache.delete(k); return null; }
  return v.data;
};
const set = (k, data) => cache.set(k, { data, t: Date.now() });

function num(x){ const n = Number(x); return Number.isFinite(n) ? n : 0; }
function fromLabel(ln={}) {
  return { calories: num(ln.calories?.value), carbs: num(ln.carbohydrates?.value), sugars: num(ln.sugars?.value) };
}
function fromNutrients(list=[]) {
  const find = code => list.find(n => String(n?.nutrient?.number) === String(code))?.amount;
  return { calories: num(find(1008)), carbs: num(find(1005)), sugars: num(find(2000)) };
}

app.post('/nutrition', async (req, res) => {
  try {
    if (!USDA_KEY) return res.status(500).json({ error: 'USDA_API_KEY missing in .env' });
    const name = (req.body?.name || '').trim();
    const brand = (req.body?.brand || '').trim();
    if (!name) return res.status(400).json({ error: 'name required' });

    const q = [brand, name].filter(Boolean).join(' ').trim() || name;
    const cacheKey = `USDA::${q.toLowerCase()}`;
    const cached = get(cacheKey);
    if (cached) return res.json(cached);

    // search
    const s = await fetch(`${API}/foods/search?query=${encodeURIComponent(q)}&pageSize=5&api_key=${USDA_KEY}`);
    if (!s.ok) throw new Error('search_failed');
    const sj = await s.json();
    const hits = Array.isArray(sj.foods) ? sj.foods : [];
    if (!hits.length) return res.status(404).json({ error: 'not_found' });

    // pick a candidate
    const pick = (brand ? hits.find(h => h.dataType === 'Branded') : null) || hits[0];

    // details
    const d = await (await fetch(`${API}/food/${pick.fdcId}?api_key=${USDA_KEY}`)).json();
    const nutrients = d.labelNutrients ? fromLabel(d.labelNutrients) : fromNutrients(d.foodNutrients);

    const out = {
      source: 'usda',
      matchType: brand ? ( (d.brandOwner||'').toLowerCase().includes(brand.toLowerCase()) ? 'exact' : 'likely') : 'generic',
      serving_desc: d.householdServingFullText || (d.servingSize && d.servingSizeUnit ? `${d.servingSize} ${d.servingSizeUnit}` : '100 g'),
      calories_kcal: Math.round(nutrients.calories || 0),
      carbs_g: Math.round(nutrients.carbs || 0),
      sugar_g: Math.round(nutrients.sugars || 0),
      raw_name: d.description || pick.description || ''
    };

    set(cacheKey, out);
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: 'server_error' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Nutrition API (USDA) on http://localhost:${PORT}`));
