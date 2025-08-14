# AllergyGuard AI

AllergyGuard AI is a smart food safety tool that helps you **check allergens**, **analyze nutrition**, and **get AI-powered health summaries** instantly — so you can shop and eat with confidence.

## ✨ Features
- **Select allergens** (saved locally via LocalStorage)
- **Search packaged foods** (OpenFoodFacts API)
- **Highlight allergen keywords** in ingredient lists
- **Nutrition data** from USDA: calories, carbs, sugar per serving
- **Diabetic Mode** — flags foods based on sugar & carb content
- **Badge System** — Eat / Limit / Avoid (based on carb & sugar thresholds)
- **AI Integration (OpenAI)** — AI-generated nutritional & allergen summaries
- Clear allergen risk indicators:
  - 🟢 Looks Clear — no selected allergens detected
  - 🔴 Allergen Risk — contains one or more selected allergens

## 🛠 Tech Stack
**Frontend:**
- React + TypeScript
- CSS for responsive UI

**Backend:**
- Node.js + Express
- OpenFoodFacts API (products & ingredients)
- USDA FoodData Central API (nutrition)
- OpenAI API (AI summaries)

**Other Tools:**
- GitHub (version control)
- Visual Studio Code

## 🚀 Getting Started

### Prerequisites
- Node.js v18+ (for built-in `fetch` support)
- USDA API Key
- OpenAI API Key

### Backend Setup
```bash
cd server
npm install

# Create server/.env with:
# USDA_API_KEY=YOUR_FDC_API_KEY
# OPENAI_API_KEY=YOUR_OPENAI_KEY
# PORT=3001

npm start

📂 [Please refer to Screenshots_AllergyGuardAI.pptx in the root folder of the project](Screenshots_AllergyGuardAI.pptx)

 


