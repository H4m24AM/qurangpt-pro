"use client"

import { useEffect, useRef, useState } from "react"
import type { FormEvent } from "react"
import { BookOpen, Search } from "lucide-react"
import type { FollowUp, Hadith, Lookup, Source, Study, Verse } from "@/lib/quran/types"

const examples = [
  { query: "2:255", label: "2:255" },
  { query: "Al-Ikhlas", label: "Al-Ikhlas" },
  { query: "patience", label: "Patience" },
]

type StudyResult = { tafsir: Source[]; hadith: Hadith[]; notices: string[]; study: Study | null; error?: string }

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || "The request failed. Please try again.")
  return data as T
}

export function StudyDesk({ initialQuery }: { initialQuery: string }) {
  const [query, setQuery] = useState(initialQuery)
  const [submitted, setSubmitted] = useState(initialQuery)
  const [result, setResult] = useState<Lookup | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(Boolean(initialQuery))
  const active = useRef<AbortController>(null)

  async function find(value: string, page = 1) {
    const text = value.trim()
    if (!text) return
    active.current?.abort()
    const controller = new AbortController()
    active.current = controller
    setSubmitted(text)
    setQuery(text)
    setLoading(true)
    setError("")
    setResult(null)
    try {
      const params = new URLSearchParams({ q: text, page: String(page) })
      const next = await request<Lookup>(`/api/qurangpt?${params}`, { signal: controller.signal })
      if (!controller.signal.aborted) setResult(next)
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Search failed. Please try again.")
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }

  useEffect(() => {
    if (initialQuery) void find(initialQuery)
    return () => active.current?.abort()
  }, [initialQuery])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = query.trim()
    if (!text) return
    window.history.replaceState(null, "", `/?${new URLSearchParams({ q: text })}`)
    void find(text)
  }

  return (
    <main className={submitted ? "has-search" : ""}>
      <section className="search-section" aria-labelledby="search-title">
        <div className="book-mark" aria-hidden="true"><BookOpen size={27} strokeWidth={1.6} /></div>
        <h1 id="search-title">Explore the Quran</h1>
        <form className="search-form" onSubmit={submit} role="search">
          <label className="sr-only" htmlFor="query">Search by ayah, surah, Arabic text, or topic</label>
          <Search className="search-icon" size={21} aria-hidden="true" />
          <input id="query" name="q" dir="auto" value={query} onChange={event => setQuery(event.target.value)}
            placeholder="Enter an ayah, surah, or topic" maxLength={240} required />
          <button type="submit">Search</button>
        </form>
        <div className="examples" aria-label="Example searches">
          {examples.map(example => <a key={example.query} href={`/?${new URLSearchParams({ q: example.query })}`}>{example.label}</a>)}
        </div>
      </section>
      <div className="results" aria-busy={loading}>
        {loading && <p role="status" className="notice">Searching Quran sources…</p>}
        {error && <p role="alert" className="notice error">{error}</p>}
        {result?.kind === "verse" && <VerseStudy key={result.verse.key} verse={result.verse} />}
        {result?.kind === "chapter" && (
          <section aria-labelledby="chapter-title">
            <div className="result-heading">
              <h2 id="chapter-title">{result.chapter.name}</h2>
              <p><span lang="ar" dir="rtl">{result.chapter.arabic}</span> · {result.chapter.verses} ayahs
                {result.chapter.revelation && ` · ${result.chapter.revelation === "makkah" ? "Makki" : result.chapter.revelation === "madinah" ? "Madani" : result.chapter.revelation}`}</p>
            </div>
            {result.verses.map(verse => <VerseCard key={verse.key} verse={verse} list />)}
          </section>
        )}
        {result?.kind === "results" && (
          <section aria-labelledby="results-title">
            <h2 id="results-title">Search results</h2>
            {result.results.length === 0 && <p>Try a shorter phrase, an ayah reference such as 2:255, or the name of a surah.</p>}
            <ul className="matches">
              {result.results.map(hit => <li key={hit.key}><a href={`/?${new URLSearchParams({ q: hit.key })}`}>
                <span className="verse-reference">{hit.kind === "verse" ? hit.key : `Surah ${hit.key}`}</span>
                <span dir="auto">{hit.title}</span>
                {hit.arabic && hit.arabic !== hit.title && <span className="arabic small" dir="rtl" lang="ar" translate="no">{hit.arabic}</span>}
              </a></li>)}
            </ul>
          </section>
        )}
        {result && result.kind !== "verse" && (result.page > 1 || result.nextPage) && (
          <nav className="pagination" aria-label="Result pages">
            {result.page > 1 && <button type="button" className="secondary" onClick={() => void find(submitted, result.page - 1)}>Previous</button>}
            <span>Page {result.page}</span>
            {result.nextPage && <button type="button" className="secondary" onClick={() => void find(submitted, result.nextPage!)}>Next</button>}
          </nav>
        )}
      </div>
    </main>
  )
}

function VerseCard({ verse, list = false }: { verse: Verse; list?: boolean }) {
  return (
    <article className="verse-card" aria-label={`Ayah ${verse.key}`}>
      <div className="verse-header">
        {list ? <a className="verse-reference" href={`/?${new URLSearchParams({ q: verse.key })}`}>Study {verse.key}</a>
          : <h2>Ayah {verse.key}</h2>}
        <a href={verse.url} target="_blank" rel="noreferrer">Quran.com</a>
      </div>
      <p className="arabic" dir="rtl" lang="ar" translate="no">{verse.arabic}</p>
      {verse.transliteration && <p className="transliteration">{verse.transliteration}</p>}
      <p>{verse.translation}</p>
      <p className="attribution">{verse.translator}</p>
    </article>
  )
}

function VerseStudy({ verse }: { verse: Verse }) {
  const [data, setData] = useState<StudyResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [failure, setFailure] = useState("")
  const [question, setQuestion] = useState("")
  const [history, setHistory] = useState<(FollowUp & { sourceIds: string[] })[]>([])
  const firstStudy = useRef(false)

  async function study(followUp?: string) {
    setLoading(true)
    setFailure("")
    try {
      const answer = await request<StudyResult>("/api/qurangpt", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: verse.key, question: followUp, history: history.slice(-4).map(turn => ({
          question: turn.question, answer: turn.answer.slice(0, 2400),
        })) }),
      })
      setData(previous => ({ ...answer, study: answer.study ?? previous?.study ?? null }))
      if (followUp && answer.study?.answer) {
        const reply = answer.study.answer
        setHistory(items => [...items, { question: followUp, answer: reply.text, sourceIds: reply.sourceIds }])
        setQuestion("")
      } else if (followUp && !answer.error) {
        setFailure("No follow-up answer was returned. Try rephrasing your question.")
      }
      if (answer.error) setFailure(answer.error)
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "The study could not be loaded.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (firstStudy.current) return
    firstStudy.current = true
    void study()
  // A new ayah mounts a fresh VerseStudy component.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sources = new Map<string, { title: string; url: string | null }>([
    ...(data?.tafsir ?? []).map(source => [source.id, source] as const),
    ...(data?.hadith ?? []).map((record, index) => [`hadith-${index + 1}`,
      { title: `${record.collection} ${record.number}`, url: record.url }] as const),
  ])
  function citations(ids: string[]) {
    return ids.map(id => {
      const source = sources.get(id)
      if (!source) return null
      return source.url ? <a key={id} href={source.url} target="_blank" rel="noreferrer">{source.title}</a>
        : <span key={id}>{source.title}</span>
    })
  }

  return (
    <div>
      <VerseCard verse={verse} />
      <div className="study-actions">
        {loading && <span role="status">Preparing your AI study analysis…</span>}
        {failure && !data?.study && <button type="button" onClick={() => void study()} disabled={loading}>Retry analysis</button>}
      </div>
      {failure && <p role="alert" className="notice error">{failure}</p>}
      {data && (
        <div className="study-sections">
          {data.study && <section className="panel">
            <h2>Arabic &amp; grammar <small>AI study notes</small></h2>
            {data.study.grammar.length > 0 ? <ol className="grammar">{data.study.grammar.map(word => (
              <li key={word.position} value={word.position}>
                <strong lang="ar" dir="rtl">{verse.words[word.position - 1]?.arabic}</strong>
                <span>{word.arabicTerm} · {word.transliteratedTerm}</span>
                <p>{word.explanation}</p>
              </li>
            ))}</ol> : <p>Word-by-word analysis is unavailable for this ayah.</p>}
          </section>}
          <section className="panel">
            <h2>Tafsir</h2>
            {data.study?.tafsir.map((item, i) => <div className="comment" key={i}>
              <p>{item.explanation}</p><div className="sources">{citations(item.sourceIds)}</div>
            </div>)}
            {data.tafsir.map(source => <details key={source.id}><summary>{source.title}</summary>
              <p>{source.text}</p><a href={source.url} target="_blank" rel="noreferrer">Open the source</a>
            </details>)}
            {data.tafsir.length === 0 && <p>{data.notices.find(note => note.includes("tafsir")) || "No tafsir is available."}</p>}
          </section>
          <section className="panel">
            <h2>Related hadith</h2>
            {data.hadith.map((record, i) => <article className="comment" key={i}>
              <h3>{record.collection} {record.number}</h3>
              <p>{record.text}</p>
              <p className="attribution">{record.grades.length
                ? record.grades.map(item => item.grader ? `${item.grade} (${item.grader})` : item.grade).join(" · ")
                : "The source does not supply a grade."}</p>
              <div className="sources">{citations([`hadith-${i + 1}`])}</div>
            </article>)}
            {data.hadith.length === 0 && <p>{data.notices.find(note => note.includes("hadith")) || "No related hadith is available."}</p>}
          </section>
          {data.study?.literaryAnalysis && <section className="panel"><h2>Literary analysis <small>AI study notes</small></h2><p>{data.study.literaryAnalysis}</p></section>}
          {!!data.study?.calendar.length && <section className="panel"><h2>Islamic calendar context</h2>{data.study.calendar.map((item, i) =>
            <div className="comment" key={i}><p>{item.explanation}</p><div className="sources">{citations(item.sourceIds)}</div></div>)}</section>}
          {data.study && <section className="panel">
            <h2>Ask a follow-up</h2>
            <div aria-live="polite">{history.map((turn, i) => <div className="comment" key={i}>
              <h3>{turn.question}</h3><p>{turn.answer}</p>
              <div className="sources">{citations(turn.sourceIds)}</div>
            </div>)}</div>
            <form className="follow-up" onSubmit={event => { event.preventDefault(); if (question.trim()) void study(question.trim()) }}>
              <label className="sr-only" htmlFor="follow-up">Question about this ayah</label>
              <input id="follow-up" dir="auto" placeholder="Ask about a word, meaning, or source" maxLength={600}
                value={question} onChange={event => setQuestion(event.target.value)} required />
              <button type="submit" disabled={loading}>Ask</button>
            </form>
          </section>}
          {data.study && <p className="attribution">And Allah knows best!</p>}
        </div>
      )}
    </div>
  )
}
