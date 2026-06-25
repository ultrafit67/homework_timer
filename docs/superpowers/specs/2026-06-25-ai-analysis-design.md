# AI Analysis Design

Add AI analysis feature to homework timer app using DeepSeek API.

## Features

- **API Key config** on Timer page (next to manual record link)
- **Analysis section** on Records page (between date filter and record list)
- **Prompt**: DeepSeek analyzes time distribution, trends, balance, and efficiency tips
- **History**: save last 20 analyses in localStorage, viewable in collapsible list
- **Markdown rendering**: `react-markdown` + `remark-gfm`

## Files

| File | Purpose |
|---|---|
| `src/hooks/useAI.ts` | Hook: API call, loading/error state, history CRUD |
| `src/components/ApiKeyDialog.tsx` | Dialog to input/save DeepSeek API Key |
| `src/components/AIAnalysis.tsx` | Analysis section: trigger button, result display, history |

## Data Flow

1. User filters records (user + date range) on Records page
2. Clicks `AI分析` → `useAI.analyze()` called with:
   - filtered records, user name, grade, date range
3. Hook constructs prompt → POST to DeepSeek → returns markdown
4. Result rendered via `react-markdown`
5. Result saved to localStorage history (max 20)
