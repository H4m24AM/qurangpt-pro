import assert from "node:assert/strict"
import test from "node:test"
import { GET, POST } from "../app/api/qurangpt/route"

const origin = "https://quran.example"
const fixtureVerse = {
  id: 1,
  verse_key: "1:1",
  verse_number: 1,
  text_uthmani: "بِسْمِ ٱللَّهِ",
  translations: [{ resource_id: 131, resource_name: "Fixture translation", text: "Fixture text" }],
  words: [{ char_type_name: "word", position: 1, text_uthmani: "بِسْمِ" }],
  tafsirs: [{ resource_id: 169, resource_name: "Fixture tafsir", text: "Fixture tafsir text" }],
}

function studyRequest(body: object) {
  return new Request(origin + "/api/qurangpt", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  })
}

test("runs the ayah and follow-up endpoint through the provider SDK and the Responses API contract", async context => {
  for (const [name, value] of Object.entries({
    QF_CLIENT_ID: "test-client", QF_CLIENT_SECRET: "test-secret", QF_ENV: "prelive", OPENAI_API_KEY: "test-openai",
  })) {
    const previous = process.env[name]
    process.env[name] = value
    context.after(() => { if (previous === undefined) delete process.env[name]; else process.env[name] = previous })
  }
  const calls: string[] = []
  let aiAvailable = true
  context.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init)
    const url = new URL(request.url)
    const path = decodeURIComponent(url.pathname)
    calls.push(path)
    if (url.hostname === "prelive-oauth2.quran.foundation") {
      assert.equal(request.method, "POST")
      return Response.json({ access_token: "test-token", token_type: "Bearer", expires_in: 3600 })
    }
    if (url.hostname === "apis-prelive.quran.foundation") {
      assert.equal(request.headers.get("x-client-id"), "test-client")
      assert.equal(request.headers.get("x-auth-token"), "test-token")
      if (path.endsWith("/chapters")) return Response.json({ chapters: [
        { id: 1, name_simple: "Al-Fatihah", name_arabic: "الفاتحة", verses_count: 7, revelation_place: "makkah" },
      ] })
      if (path.endsWith("/verses/by_chapter/1")) return Response.json({ verses: [fixtureVerse] })
      if (path.endsWith("/search/v1/search")) return Response.json({
        result: { navigation: [], verses: [{ result_type: "ayah", key: "1:1", name: "Fixture match", arabic: fixtureVerse.text_uthmani }] },
        pagination: { current_page: 1, next_page: null },
      })
      if (path.endsWith("/verses/by_key/1:1")) return Response.json({ verse: { ...fixtureVerse, translations: [] } })
      if (path.endsWith("/quran/translations/131")) {
        assert.equal(url.searchParams.get("verse_key"), "1:1")
        return Response.json({ translations: [{ ...fixtureVerse.translations[0], verse_key: "1:1" }] })
      }
      if (path.includes("/hadith") && path.includes("1:1")) return Response.json({
        hadiths: [{ urn: 410, name: "Sahih al-Bukhari", collection: "bukhari", hadith_number: "1",
          hadith: [{ lang: "en", body: "Fixture hadith text", grades: [{ grade: "Sahih", graded_by: "Fixture grader" }] }] }],
      })
    }
    if (url.hostname === "api.openai.com") {
      if (!aiAvailable) return Response.json({}, { status: 503 })
      const requestBody = await request.json()
      const input = JSON.parse(requestBody.input)
      assert.equal(input.verse.key, "1:1")
      assert.equal(input.evidence.length, 2)
      if (input.question) assert.equal(input.history[0].answer, "Earlier answer")
      return Response.json({ status: "completed", output: [{ type: "message", content: [{
        type: "output_text",
        text: JSON.stringify({
          grammar: [{ position: 1, arabicTerm: "Fixture", transliteratedTerm: "Fixture", explanation: "Fixture explanation" }],
          tafsir: [{ explanation: "Fixture", sourceIds: ["tafsir-169-1", "invented"] }],
          literaryAnalysis: "Fixture", calendar: [],
          answer: input.question ? { text: "Follow-up answer", sourceIds: ["hadith-1"] } : null,
        }),
      }] }] })
    }
    assert.fail(`Unexpected upstream request ${request.method} ${url.hostname}${path}`)
  })

  const original = await GET(new Request(origin + "/api/qurangpt?q=١:١"))
  assert.equal(original.status, 200)
  assert.equal((await original.json()).verse.arabic, fixtureVerse.text_uthmani)
  assert.ok(!calls.includes("/v1/responses"))

  const chapter = await GET(new Request(origin + "/api/qurangpt?q=Al-Fatihah"))
  assert.equal((await chapter.json()).chapter.name, "Al-Fatihah")

  const search = await GET(new Request(origin + "/api/qurangpt?q=mercy"))
  const searchData = await search.json()
  assert.equal(search.status, 200, JSON.stringify({ calls, searchData }))
  assert.equal(searchData.results[0].key, "1:1")

  const first = await POST(studyRequest({ key: "1:1" }))
  assert.equal(first.status, 200)
  const firstData = await first.json()
  assert.deepEqual(firstData.study?.tafsir[0].sourceIds, ["tafsir-169-1"], JSON.stringify({ calls, firstData }))
  assert.equal(firstData.hadith[0].grades[0].grader, "Fixture grader")

  const second = await POST(studyRequest({ key: "1:1", question: "Explain the previous point", history: [
    { question: "What does the word mean?", answer: "Earlier answer" },
  ] }))
  const secondData = await second.json()
  assert.equal(secondData.study.answer.text, "Follow-up answer")
  assert.deepEqual(secondData.study.answer.sourceIds, ["hadith-1"])

  aiAvailable = false
  const fallback = await POST(studyRequest({ key: "1:1" }))
  const fallbackData = await fallback.json()
  assert.equal(fallbackData.study, null)
  assert.match(fallbackData.error, /AI study is temporarily unavailable/)
  assert.equal(fallbackData.verse.key, "1:1")
})

test("rejects malformed requests before contacting a provider", async () => {
  assert.equal((await GET(new Request(origin + "/api/qurangpt?q=200:1"))).status, 400)
  assert.equal((await POST(studyRequest({ key: "hello" }))).status, 400)
})
