export function normalizeSearch(input: string) {
  return input.normalize("NFKC")
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x6f0))
    .trim()
}

export function verseKey(input: string): string | null {
  const match = /^(\d{1,3})\s*[:：.]\s*(\d{1,3})$/.exec(normalizeSearch(input))
  if (!match) return null
  const chapter = Number(match[1])
  const verse = Number(match[2])
  return chapter >= 1 && chapter <= 114 && verse >= 1 && verse <= 286 ? `${chapter}:${verse}` : null
}

export function simpleName(input: string) {
  return normalizeSearch(input).toLowerCase().normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/[^\p{L}\p{N}]/gu, "")
}

const entities: Record<string, string> = {
  amp: "&", apos: "'", quot: '"', lt: "<", gt: ">", nbsp: " ",
  rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", ndash: "–", mdash: "—",
}

export function plainText(value: string) {
  return value
    .replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, "")
    .replace(/<\/?(?:p|div|br|li)\b[^>]*>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (original, entity: string) => {
      if (entity[0] !== "#") return entities[entity] ?? original
      const code = entity[1]?.toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : Number(entity.slice(1))
      return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
        ? String.fromCodePoint(code)
        : original
    })
    .replace(/\s+/g, " ").trim()
}
