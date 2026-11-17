export type Chapter = {
  id: number
  name: string
  arabic: string
  verses: number
  revelation: string
}

export type Verse = {
  key: string
  arabic: string
  transliteration: string
  translation: string
  translator: string
  url: string
  words: { arabic: string; transliteration: string; translation: string }[]
}

export type Source = {
  id: string
  title: string
  text: string
  url: string
}

export type Hadith = {
  collection: string
  number: string
  text: string
  grades: { grade: string; grader: string }[]
  url: string | null
}

export type SearchMatch = {
  kind: "verse" | "chapter"
  key: string
  title: string
  arabic: string
}

export type Study = {
  grammar: { position: number; arabicTerm: string; transliteratedTerm: string; explanation: string }[]
  tafsir: { explanation: string; sourceIds: string[] }[]
  literaryAnalysis: string
  calendar: { explanation: string; sourceIds: string[] }[]
  answer: { text: string; sourceIds: string[] } | null
}

export type FollowUp = { question: string; answer: string }

export type Lookup =
  | { kind: "verse"; verse: Verse }
  | { kind: "chapter"; chapter: Chapter; verses: Verse[]; page: number; nextPage: number | null }
  | { kind: "results"; results: SearchMatch[]; page: number; nextPage: number | null }
