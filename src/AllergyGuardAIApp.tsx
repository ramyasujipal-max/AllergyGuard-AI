import React, { useEffect, useMemo, useState } from "react";
import "./AllergyGuardAIApp.css";

type Product = {
  code: string;
  product_name?: string;
  brands?: string;
  ingredients_text?: string;
  allergens_tags?: string[];
};

type NutritionInfo = {
  source: "usda";
  matchType: "exact" | "likely" | "generic";
  serving_desc: string;
  calories_kcal: number;
  carbs_g: number;
  sugar_g: number;
  raw_name?: string;
};

const API_BASE = "http://localhost:3001";

function classifyCarbs(carbs: number) {
  if (carbs > 30) return { label: "Avoid", color: "#d33", bg: "#ffecec" };
  if (carbs >= 15) return { label: "Limit", color: "#a96d00", bg: "#fff4d6" };
  return { label: "Eat", color: "#1a7f37", bg: "#e9f7ef" };
}

// Allergen definitions
const ALLERGENS = [
  { key: "peanut", labels: ["peanut", "groundnut", "arachis"] },
  { key: "tree_nuts", labels: ["almond","walnut","pecan","hazelnut","pistachio","cashew","brazil nut","macadamia"] },
  { key: "milk", labels: ["milk","dairy","casein","whey","lactose"] },
  { key: "egg", labels: ["egg","albumen","ovalbumin"] },
  { key: "gluten", labels: ["gluten","wheat","barley","rye","spelt","malt"] },
  { key: "soy", labels: ["soy","soya","soybean","lecithin (soya)"] },
  { key: "sesame", labels: ["sesame","tahini","sesamum"] },
  { key: "fish", labels: ["fish","anchovy","cod","salmon","tuna"] },
  { key: "shellfish", labels: ["shrimp","prawn","crab","lobster","oyster","clam","mussel","scallop"] },
  { key: "mustard", labels: ["mustard"] },
  { key: "celery", labels: ["celery"] },
  { key: "sulfites", labels: ["sulphite","sulfite","e220","e221","e222","e223","e224","e226","e227","e228"] },
];

// Load/save profile from localStorage
type Profile = Record<string, boolean>;
const loadProfile = (): Profile => {
  try { return JSON.parse(localStorage.getItem("allergyguardai_profile") || "{}"); } catch { return {}; }
};
const saveProfile = (p: Profile) => localStorage.setItem("allergyguardai_profile", JSON.stringify(p));

// Highlight allergen keywords in ingredient text
function highlight(text: string, needles: string[]) {
  if (!text) return "";
  const safe = needles.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`\\b(${safe.join("|")})\\b`, "gi");
  return text.replace(re, m => `<mark style="background:#ffcccc">${m}</mark>`);
}

// Background & overlay styles
const bgStyle = {
  position: "relative" as const,
  minHeight: "100vh",
  backgroundImage: "url('/images/background.jpg')",
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
};
const overlayStyle = {
  position: "fixed" as const,
  top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: "rgba(0, 0, 0, 0.35)",
  zIndex: 0,
};
const contentStyle = {
  position: "relative" as const,
  zIndex: 1,
  maxWidth: 920,
  margin: "32px auto",
  padding: 16,
  fontFamily: "system-ui, sans-serif",
  color: "#000",
  backgroundColor: "rgba(255, 255, 255, 0.85)",
  borderRadius: 12,
  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
};

export default function AllergyGuardAIApp() {
  // ---- existing state ----
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Product[]>([]);
  const [picked, setPicked] = useState<Product | undefined>(undefined);
  const [profile, setProfile] = useState<Profile>(() => loadProfile());

  // ---- NEW: nutrition state (must be inside component) ----
  const [nutrition, setNutrition] = useState<NutritionInfo | null>(null);
  const [nLoading, setNLoading] = useState(false);
  const [nError, setNError] = useState<string | null>(null);

  useEffect(() => saveProfile(profile), [profile]);

  // fetch nutrition when a product is selected
  useEffect(() => {
    setNutrition(null);
    setNError(null);
    if (!picked) return;

    const name = picked.product_name || "";
    const brand = picked.brands || "";
    if (!name) return;

    setNLoading(true);
    fetch(`${API_BASE}/nutrition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, brand }),
    })
      .then(r => (r.ok ? r.json() : Promise.reject(r)))
      .then((data: NutritionInfo) => setNutrition(data))
      .catch(() => setNError("Nutrition unavailable"))
      .finally(() => setNLoading(false));
  }, [picked]);

  const selectedLabels = useMemo(() => {
    const out: string[] = [];
    for (const a of ALLERGENS) if (profile[a.key]) out.push(...a.labels);
    return out;
  }, [profile]);

  // Checks allergen risk for a product
  const riskFor = (p?: Product) => {
    if (!p) return { hits: [] as string[], hasRisk: false };
    const ing = (p.ingredients_text || "").toLowerCase();
    const hits = selectedLabels.filter(lbl => ing.includes(lbl.toLowerCase()));
    const tagHits = (p.allergens_tags || [])
      .map(t => t.replace(/^..:/, ""))
      .filter(t =>
        ALLERGENS.some(a => profile[a.key] && (a.key === t || a.labels.includes(t)))
      );
    const uniq = Array.from(new Set([...hits, ...tagHits]));
    return { hits: uniq, hasRisk: uniq.length > 0 };
  };

  // Select/Deselect all
  const selectAllAllergens = () => {
    const allSelected: Record<string, boolean> = {};
    ALLERGENS.forEach(a => { allSelected[a.key] = true; });
    setProfile(allSelected);
  };
  const deselectAllAllergens = () => {
    const noneSelected: Record<string, boolean> = {};
    ALLERGENS.forEach(a => { noneSelected[a.key] = false; });
    setProfile(noneSelected);
  };

  // Search OpenFoodFacts
  async function search() {
    if (!q.trim()) { setResults([]); setPicked(undefined); return; }
    setLoading(true);
    setPicked(undefined);
    setResults([]);

    try {
      const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=20&sort_by=unique_scans_n`;
      const r = await fetch(url);
      const j = await r.json();

      const filtered = (j.products || []).filter((p: any) =>
        p.product_name && p.product_name.toLowerCase().includes(q.toLowerCase())
      );

      const prods: Product[] = filtered.map((p: any) => {
        const allergens_en = (p.allergens_tags || [])
          .filter((tag: string) => tag.startsWith("en:"))
          .map((tag: string) => tag.substring(3));
        return {
          code: p.code,
          product_name: p.product_name,
          brands: p.brands,
          ingredients_text: p.ingredients_text,
          allergens_tags: allergens_en,
        };
      });

      const uniqueProdsMap = new Map<string, Product>();
      for (const p of prods) {
        const name = p.product_name ?? "";
        if (name && !uniqueProdsMap.has(name)) uniqueProdsMap.set(name, p);
      }
      const uniqueProds = Array.from(uniqueProdsMap.values());
      setResults(uniqueProds.slice(0, 5));
    } catch (e) {
      console.error(e);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  const pickedRisk = riskFor(picked);
  const highlighted = picked?.ingredients_text
    ? highlight(picked.ingredients_text, selectedLabels)
    : "";

  return (
    <div style={bgStyle}>
      <div style={overlayStyle} />
      <div style={contentStyle}>
        <h1 className="allergyguardai-heading">🥗 AllergyGuardAI</h1>
        <p className="allergyguardai-subtitle">Instant allergen check for packaged foods.</p>

        {/* Profile Section */}
        <section style={{
          background: "#fafafa",
          border: "2px solid #0078D4",
          borderRadius: 12,
          padding: 12,
          marginBottom: 16,
          boxShadow: "0 0 8px rgba(0, 120, 212, 0.3)"
        }}>
          <strong style={{ fontSize: "1.2rem", fontWeight: 700, color: "#0078D4" }}>My allergens:</strong>
          <div style={{ marginBottom: 8, display: "flex", gap: 12 }}>
            <button onClick={selectAllAllergens} className="button-primary">Select All</button>
            <button onClick={deselectAllAllergens} className="button-secondary">Deselect All</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px,1fr))", gap: 8, marginTop: 8 }}>
            {ALLERGENS.map(a => (
              <label key={a.key} className="uppercase" style={{ display: "flex", gap: 8, alignItems: "center", padding: 8, border: "1px solid #eee", borderRadius: 8 }}>
                <input
                  type="checkbox"
                  checked={!!profile[a.key]}
                  onChange={e => setProfile(prev => ({ ...prev, [a.key]: e.target.checked }))}
                />
                {a.key.replace(/_/g, " ")}
              </label>
            ))}
          </div>
          <small style={{ color: "#666" }}>Saved to this device only.</small>
        </section>

        {/* Search Section */}
        <section style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Try 'Nutella', 'Cheerios', 'Oreos'..."
            style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid #ddd", fontSize: "1.1rem" }}
            onKeyDown={(e) => e.key === "Enter" && search()}
          />
          <button onClick={search} disabled={loading} className="microsoft-blue-button">
            {loading ? "Searching…" : "Search"}
          </button>
        </section>

        {/* Results Section */}
        <div style={{ border: "2px solid #0078D4", borderRadius: 10, padding: 8, backgroundColor: "#fff", boxShadow: "0 2px 8px rgba(0,120,212,0.1)" }}>
          <section style={{ display: "grid", gap: 8 }}>
            {results.map(p => {
              const { hasRisk } = riskFor(p);
              return (
                <div
                  key={p.code}
                  onClick={() => setPicked(p)}
                  style={{
                    cursor: "pointer",
                    border: "1px solid #eee",
                    borderRadius: 10,
                    padding: 10,
                    background: picked?.code === p.code ? "#f0f7ff" : "#fff",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{p.product_name || "(no name)"}</div>
                    <div style={{ color: "#666", fontSize: 12 }}>{p.brands}</div>
                  </div>
                  <span style={{
                    fontSize: 12, padding: "4px 8px", borderRadius: 999, border: "1px solid",
                    borderColor: hasRisk ? "#d33" : "#1a7f37",
                    color: hasRisk ? "#d33" : "#1a7f37",
                    background: hasRisk ? "#ffecec" : "#e9f7ef"
                  }}>
                    {hasRisk ? "Allergen risk" : "Looks clear"}
                  </span>
                </div>
              );
            })}
          </section>
        </div>

        {/* Details Section */}
        {picked && (
          <section style={{ marginTop: 16, border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <h3 style={{ margin: 0 }}>{picked.product_name || "Product details"}</h3>
              <code style={{ color: "#666" }}>#{picked.code}</code>
            </div>
            <div style={{ color: "#666", marginBottom: 8 }}>{picked.brands}</div>

            <div style={{ marginTop: 8 }}>
              <strong>Ingredients:</strong>
              <div
                style={{ marginTop: 6, lineHeight: 1.5 }}
                dangerouslySetInnerHTML={{ __html: highlighted || "<i>No ingredients listed</i>" }}
              />
            </div>

            <div style={{ marginTop: 10 }}>
              <strong>Allergen tags:</strong>{" "}
              {(picked.allergens_tags && picked.allergens_tags.length)
                ? picked.allergens_tags.join(", ")
                : <i>none listed</i>}
            </div>

            {/* Nutrition Section (inside details) */}
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px dashed #ddd" }}>
              <strong>Nutrition (per serving):</strong>
              {nLoading && <div style={{ color: "#666", marginTop: 6 }}>Fetching nutrition…</div>}
              {nError && <div style={{ color: "#b30000", marginTop: 6 }}>{nError}</div>}

              {nutrition && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                    <div>Calories: <b>{Math.round(nutrition.calories_kcal)}</b> kcal</div>
                    <div>Carbs: <b>{Math.round(nutrition.carbs_g)}</b> g</div>
                    <div>Sugar: <b>{Math.round(nutrition.sugar_g)}</b> g</div>
                    <div style={{ color: "#666" }}>Serving: {nutrition.serving_desc}</div>
                  </div>

                  {(() => {
                    const badge = classifyCarbs(nutrition.carbs_g);
                    return (
                      <div style={{
                        marginTop: 10, display: "inline-block", padding: "6px 10px",
                        borderRadius: 999, border: `1px solid ${badge.color}`,
                        color: badge.color, background: badge.bg, fontWeight: 600
                      }}>
                        {badge.label}
                      </div>
                    );
                  })()}

                  <div style={{ marginTop: 6, color: "#777", fontSize: 12 }}>
                    Match: {nutrition.matchType} • Source: {nutrition.source}
                    {nutrition.raw_name ? ` • Found: ${nutrition.raw_name}` : ""}
                  </div>
                </div>
              )}
            </div>

            <div style={{
              marginTop: 12, padding: 10, borderRadius: 8,
              background: pickedRisk.hasRisk ? "#ffecec" : "#e9f7ef",
              color: pickedRisk.hasRisk ? "#b30000" : "#1a7f37",
              border: `1px solid ${pickedRisk.hasRisk ? "#f5b5b5" : "#bfe3cc"}`
            }}>
              {pickedRisk.hasRisk
                ? <>⚠️ Potential allergens detected: <b>{pickedRisk.hits.join(", ")}</b></>
                : <>✅ No selected allergens detected</>}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
