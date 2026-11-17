import assert from "node:assert/strict"
import test from "node:test"
import { normalizeSearch, plainText, simpleName, verseKey } from "../lib/quran/input"
import { readJson } from "../lib/quran/http"
import { generateStudy, validateStudy } from "../lib/quran/study"
import type { Study, Verse } from "../lib/quran/types"

const study: Study = {
  grammar: [
    { position: 2, arabicTerm: "term", transliteratedTerm: "term", explanation: "second" },
    { position: 100, arabicTerm: "", transliteratedTerm: "", explanation: "invalid position" },
    { position: 1, arabicTerm: "term", transliteratedTerm: "term", explanation: "first" },
    { position: 1, arabicTerm: "", transliteratedTerm: "", explanation: "duplicate" },
  ],
  tafsir: [
    { explanation: "Supported", sourceIds: ["tafsir-169-1", "fake", "tafsir-169-1"] },
    { explanation: "Unsupported", sourceIds: ["fake"] },
  ],
  literaryAnalysis: "Commentary",
  calendar: [{ explanation: "Unsupported", sourceIds: ["fake"] }],
  answer: { text: "Follow-up answer", sourceIds: ["hadith-1", "fake"] },
}

const verse: Verse = {
  key: "1:1",
  arabic: "بِسْمِ ٱللَّهِ",
  transliteration: "Bismi llāh",
  translation: "Test fixture",
  translator: "Test fixture",
  url: "https://quran.com/1/1",
  words: [
    { arabic: "بِسْمِ", transliteration: "", translation: "" },
    { arabic: "ٱللَّهِ", transliteration: "", translation: "" },
  ],
}

test("parses ayah references in Western, Arabic and Persian numerals", () => {
  assert.equal(verseKey(" ٠٢ : ۲۵۵ "), "2:255")
  assert.equal(verseKey("115:1"), null)
  assert.equal(verseKey("2:287"), null)
  assert.equal(verseKey("2:0"), null)
  assert.equal(normalizeSearch(" ٢٥٥ "), "255")
  assert.equal(simpleName("Al-Ikhlāṣ"), simpleName("al ikhlas"))
})

test("preserves Arabic characters and decodes the provider's text markup", () => {
  assert.equal(plainText("<p>بِسْمِ &amp; &#x2019; <sup>1</sup></p>"), "بِسْمِ & ’")
  assert.equal(plainText("&#1114112;"), "&#1114112;")
})

test("rejects unverified citations and invalid grammar positions", () => {
  const result = validateStudy(study, 2, ["tafsir-169-1"], ["tafsir-169-1", "hadith-1"], true)
  assert.deepEqual(result.grammar.map(item => item.explanation), ["first", "second"])
  assert.deepEqual(result.tafsir, [{ explanation: "Supported", sourceIds: ["tafsir-169-1"] }])
  assert.deepEqual(result.calendar, [])
  assert.deepEqual(result.answer?.sourceIds, ["hadith-1"])
})

test("passes the current ayah, retrieved evidence and previous turns to the AI provider", async context => {
  const key = process.env.OPENAI_API_KEY
  process.env.OPENAI_API_KEY = "test-key"
  context.after(() => {
    if (key === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = key
  })
  context.mock.method(globalThis, "fetch", async (url: string, options: RequestInit) => {
    assert.equal(url, "https://api.openai.com/v1/responses")
    const request = JSON.parse(String(options.body))
    const input = JSON.parse(request.input)
    assert.equal(request.store, false)
    assert.equal(request.text.format.strict, true)
    assert.equal(input.verse.key, "1:1")
    assert.equal(input.question, "Explain that first word.")
    assert.equal(input.history[0].question, "What is the first word?")
    assert.equal(input.evidence[0].id, "tafsir-169-1")
    return Response.json({ status: "completed", output: [{ type: "message",
      content: [{ type: "output_text", text: JSON.stringify(study) }] }] })
  })
  const output = await generateStudy(verse, [{
    id: "tafsir-169-1", title: "Fixture", text: "Evidence for the verse", url: "https://quran.com/1/1",
  }], [], "Explain that first word.", [{ question: "What is the first word?", answer: "See the first word." }])
  assert.equal(output.answer?.text, "Follow-up answer")
  assert.deepEqual(output.answer?.sourceIds, [])
})

test("rejects JSON payloads larger than the input limit", async () => {
  const request = new Request("https://example.test/api", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: "large" }),
  })
  await assert.rejects(readJson(request, 4), { status: 413 })
})
