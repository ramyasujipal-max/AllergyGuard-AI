# AllergyGuard AI

AllergyGuard AI helps you check **food allergens** and see **carb/sugar per serving** instantly—so you can shop and eat with confidence.

## Features
- Select your allergens (saved in LocalStorage)
- Search packaged foods (OpenFoodFacts)
- Highlight allergen keywords in ingredients
- Nutrition (USDA): **calories, carbs, sugar** per serving
- Badge: **Eat / Limit / Avoid** (based on carbs & sugar thresholds)

## Tech Stack
- React + TypeScript (frontend)
- Node.js + Express (backend)
- OpenFoodFacts API (products/ingredients)
- USDA FoodData Central API (nutrition)

## Getting Started

### Prereqs
- Node 18+ (for built-in `fetch`)

### Backend
```bash
cd server
npm i
# create server/.env
# USDA_API_KEY=YOUR_FDC_API_KEY
# PORT=3001
npm run start
