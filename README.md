# QuranGPT Pro

A public Quran study app for Quran.Hamza.AM, built with Next.js and TypeScript. Open an ayah by reference, read a surah, or find verses by Arabic text or topic. The verse and named translation come from Quran Foundation. Opening an ayah automatically requests sourced AI study notes with an optional follow-up conversation.

## Local setup

1. Run `npm ci`.
2. Copy `.env.example` to `.env.local` and configure backend credentials there.
3. Run `npm run dev` and open `http://localhost:3000`.
4. Run `npm run check`, `npm test`, and `npm run build` before publishing.

Create a Quran Foundation Backend/server client. Grant Quran text, translation, tafsir, hadith, and Search API access. Use the corresponding pre-live or production credentials and environment. The pre-live dataset is limited to the first two surahs. Use a funded OpenAI API project whose API key is able to call the configured model.

## Desktop and deployment

Deploy this repository as a Next.js app on Vercel. Configure `OPENAI_API_KEY` and `QF_CLIENT_SECRET` as server secrets, plus the other values from `.env.example`. Set a rate limit on public requests to `/api/qurangpt` and confirm billing and usage monitoring before attaching Quran.Hamza.AM. Keep the Tech.Hamza.AM shortcut pointing at the current demo until the production site passes live lookup, sourced AI analysis, follow-up, citation, and mobile checks. Then point the shortcut and the old tool URL to Quran.Hamza.AM.

## Endpoint

- `GET /api/qurangpt?q=2:255` returns a verse, a paginated surah, or search results.
- `POST /api/qurangpt` with `{"key":"2:255"}` returns the ayah, source records, and AI study sections. Send `question` and at most four previous question-answer pairs in `history` for a follow-up.
- If AI analysis fails, the endpoint returns the verse and available records with `study: null` and an explicit error. Source identifiers and hadith grades are taken from the provider, and generated source IDs are checked against retrieved data.
