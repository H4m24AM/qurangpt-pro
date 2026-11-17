import { z } from "zod/v4"
import { AppError } from "@/lib/quran/errors"
import { apiError, readJson } from "@/lib/quran/http"
import { normalizeSearch, verseKey } from "@/lib/quran/input"
import { getSources, getVerse, lookup } from "@/lib/quran/provider"
import { generateStudy } from "@/lib/quran/study"

export const runtime = "nodejs"
export const maxDuration = 60

const studyRequest = z.object({
  key: z.string().trim().max(14),
  question: z.string().trim().min(1).max(600).optional(),
  history: z.array(z.object({
    question: z.string().trim().min(1).max(600),
    answer: z.string().trim().min(1).max(2400),
  })).max(4).optional(),
})

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams
    const query = normalizeSearch(params.get("q") ?? "")
    const page = Number(params.get("page") ?? 1)
    if (!query || query.length > 240 || !Number.isInteger(page) || page < 1 || page > 100) {
      throw new AppError(400, "Enter a surah, verse reference, Arabic phrase, or topic.")
    }
    return Response.json(await lookup(query, page))
  } catch (error) {
    return apiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const parsed = studyRequest.safeParse(await readJson(request))
    if (!parsed.success) throw new AppError(400, "Choose an ayah and keep follow-up questions under 600 characters.")
    const { key: value, question, history } = parsed.data
    const key = verseKey(value)
    if (!key) throw new AppError(400, "Choose a valid ayah first.")

    const [verse, sources] = await Promise.all([getVerse(key), getSources(key)])
    try {
      const study = await generateStudy(verse, sources.tafsir, sources.hadith, question, history)
      return Response.json({ verse, ...sources, study })
    } catch (error) {
      if (!(error instanceof AppError)) throw error
      return Response.json({ verse, ...sources, study: null, error: error.message })
    }
  } catch (error) {
    return apiError(error)
  }
}
