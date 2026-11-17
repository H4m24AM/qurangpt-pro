import "server-only"
import { SearchMode, type ChapterId, type Verse as ProviderVerse, type VerseKey } from "@quranjs/api"
import { createServerClient } from "@quranjs/api/server"
import { AppError } from "./errors"
import { normalizeSearch, plainText, simpleName, verseKey } from "./input"
import type { Chapter, Hadith, Lookup, SearchMatch, Source, Verse } from "./types"

const translationId = 131
const tafsirId = 169
const transliterationId = 57
const pageSize = 20
const verseFields = {
  fields: { textUthmani: true },
  translations: [translationId, transliterationId],
  translationFields: { resourceName: true },
}
let client: ReturnType<typeof createServerClient> | undefined

function provider() {
  const clientId = process.env.QF_CLIENT_ID
  const clientSecret = process.env.QF_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new AppError(503, "Quran content is not configured yet.")
  const prelive = process.env.QF_ENV === "prelive"
  return client ??= createServerClient({
    clientId,
    clientSecret,
    contentScopeMode: process.env.QF_LEGACY_SCOPE === "1" ? "legacy" : "granular",
    ...(prelive && {
      services: {
        gatewayUrl: "https://apis-prelive.quran.foundation",
        oauth2BaseUrl: "https://prelive-oauth2.quran.foundation",
      },
    }),
  })
}

function verseLink(key: string) {
  return `https://quran.com/${key.replace(":", "/")}`
}

export function mapVerse(record: ProviderVerse): Verse {
  const translation = record.translations?.find(item => item.resourceId === translationId)
  const words = (record.words ?? []).filter(item => item.charTypeName === "word").map(word => ({
    arabic: word.textUthmani || word.text || "",
    transliteration: plainText(word.transliteration?.text ?? ""),
    translation: plainText(word.translation?.text ?? ""),
  }))
  if (!record.textUthmani || !verseKey(record.verseKey) || !translation?.text) {
    throw new AppError(502, "The Quran source did not return the expected verse and translation.")
  }
  return {
    key: record.verseKey,
    arabic: record.textUthmani,
    translation: plainText(translation.text),
    translator: translation.resourceName || "Dr. Mustafa Khattab, The Clear Quran",
    transliteration: plainText(record.translations?.find(item => item.resourceId === transliterationId)?.text ?? "")
      || words.map(word => word.transliteration).filter(Boolean).join(" "),
    url: verseLink(record.verseKey),
    words,
  }
}

type ChapterRecord = Awaited<ReturnType<ReturnType<typeof provider>["content"]["v4"]["chapters"]["get"]>>
function mapChapter(record: ChapterRecord): Chapter {
  return {
    id: record.id,
    name: record.nameSimple || record.transliteratedName,
    arabic: record.nameArabic,
    verses: record.versesCount,
    revelation: record.revelationPlace,
  }
}

let chapterCatalog: { expires: number; data: Promise<ChapterRecord[]> } | undefined
function chapters() {
  if (!chapterCatalog || chapterCatalog.expires <= Date.now()) {
    const data = provider().content.v4.chapters.list({ language: "en" })
    chapterCatalog = { expires: Date.now() + 86400000, data }
    void data.catch(() => {
      if (chapterCatalog?.data === data) chapterCatalog = undefined
    })
  }
  return chapterCatalog.data
}

export async function getVerse(key: string) {
  const record = await provider().content.v4.verses.byKey(key as VerseKey, {
    ...verseFields,
    language: "en",
    words: true,
    wordFields: { textUthmani: true },
  })
  if (record.verseKey !== key) throw new AppError(502, "The Quran source returned a different verse.")
  return mapVerse(record)
}

export async function getChapter(id: number, page: number): Promise<Lookup> {
  const api = provider().content.v4
  const record = (await chapters()).find(chapter => chapter.id === id)
  if (!record || page > Math.ceil(record.versesCount / pageSize)) throw new AppError(404, "This surah page was not found.")
  const verses = await api.verses.byChapter(id as ChapterId, { ...verseFields, page, perPage: pageSize })
  return {
    kind: "chapter",
    chapter: mapChapter(record),
    verses: verses.map(mapVerse),
    page,
    nextPage: page * pageSize < record.versesCount ? page + 1 : null,
  }
}

export async function lookup(input: string, page: number): Promise<Lookup> {
  const query = normalizeSearch(input)
  const key = verseKey(query)
  if (HARD_REFERENCE.test(query) && !key) throw new AppError(400, "Enter a valid surah and ayah, such as 2:255.")
  if (key) return { kind: "verse", verse: await getVerse(key) }

  const chapterNumber = /^(?:surah\s+)?(\d{1,3})$/i.exec(query)
  if (chapterNumber) return getChapter(Number(chapterNumber[1]), page)
  const name = simpleName(query.replace(/^surah\s+/i, ""))
  const chapter = (await chapters()).find(item =>
    [item.nameSimple, item.nameComplex, item.transliteratedName, item.nameArabic]
      .filter(Boolean).some(candidate => simpleName(candidate) === name))
  if (chapter) return getChapter(chapter.id, page)

  const search = (text: string) => provider().search.v1.query({
    mode: SearchMode.Advanced, query: text, page, size: 12, getText: "1", highlight: "0",
    translationIds: [translationId],
  })
  const searchQuery = query.replace(/^(?:what does the qur['’]?an say about|what does the koran say about|show me verses about)\s+/i, "").replace(/[?؟]$/, "").trim() || query
  let data = await search(searchQuery)
  const withoutMarks = searchQuery.replace(/[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed]/gu, "")
  if (!data.result?.verses.length && withoutMarks !== searchQuery) data = await search(withoutMarks)
  const results = new Map<string, SearchMatch>()
  for (const hit of [...(data.result?.navigation ?? []), ...(data.result?.verses ?? [])]) {
    const key = String(hit.key)
    const kind = hit.resultType === "surah" ? "chapter" : "verse"
    if (kind === "chapter" ? !/^[1-9]\d{0,2}$/.test(key) : !verseKey(key)) continue
    results.set(key, { kind, key, title: plainText(hit.name), arabic: plainText(hit.arabic ?? "") })
  }
  return { kind: "results", results: [...results.values()], page, nextPage: data.pagination?.nextPage ?? null }
}

const HARD_REFERENCE = /^\d+\s*[:：.]\s*\d+$/
const hadithCollections = new Set(["bukhari", "muslim", "abudawud", "tirmidhi", "nasai", "ibnmajah", "malik", "ahmad", "darimi", "riyadussalihin", "adab", "mishkat", "bulugh", "nawawi40", "qudsi40"])

export async function getSources(key: string): Promise<{ tafsir: Source[]; hadith: Hadith[]; notices: string[] }> {
  const api = provider().content.v4
  const [tafsirResult, hadithResult] = await Promise.allSettled([
    api.verses.byKey(key as VerseKey, {
      tafsirs: [tafsirId], tafsirFields: { resourceName: true, slug: true },
    }),
    api.hadithReferences.hadithsByAyah(key as VerseKey, { language: "en", limit: 4 }),
  ])
  const notices: string[] = []
  const tafsir: Source[] = []
  const hadith: Hadith[] = []

  if (tafsirResult.status === "fulfilled" && tafsirResult.value.verseKey === key) {
    for (const item of tafsirResult.value.tafsirs ?? []) {
      const text = plainText(item.text ?? "")
      if (item.resourceId !== tafsirId || !text) continue
      tafsir.push({
        id: `tafsir-${tafsirId}-${tafsir.length + 1}`,
        title: item.resourceName || "Tafsir Ibn Kathir (abridged)",
        text,
        url: `${verseLink(key)}/tafsirs/en-tafisr-ibn-kathir`,
      })
    }
  }
  if (!tafsir.length) notices.push("The selected tafsir could not be verified for this ayah.")

  if (hadithResult.status === "fulfilled") {
    for (const record of hadithResult.value.hadiths ?? []) {
      const content = record.hadith.find(item => item.lang === "en") ?? record.hadith[0]
      const number = String(record.hadithNumber ?? "").trim()
      const text = plainText(content?.body ?? "")
      if (!record.name || !number || !text) continue
      const collection = record.collection.toLowerCase()
      const url = hadithCollections.has(collection) && /^\d+[a-z]?$/.test(number)
        ? `https://sunnah.com/${collection}:${number}` : null
      const grades = (content?.grades ?? []).flatMap(item => item.grade
        ? [{ grade: item.grade, grader: item.gradedBy ?? "" }] : [])
      hadith.push({ collection: record.name, number, text, grades, url })
    }
    if (!hadith.length) notices.push("The source returned no related hadith for this ayah.")
  } else {
    notices.push("Related hadith could not be retrieved right now.")
  }
  return { tafsir, hadith, notices }
}
