import { AppError } from "./errors"

export function apiError(error: unknown) {
  if (error instanceof AppError) return Response.json({ error: error.message }, { status: error.status })
  const upstream = error as { status?: number; statusCode?: number } | null
  const status = upstream?.status ?? upstream?.statusCode
  if (status === 404) return Response.json({ error: "This verse or surah was not found." }, { status })
  console.error("Quran provider request failed", { status })
  return Response.json({ error: "Quran sources are temporarily unavailable. Please try again." }, { status: 502 })
}

export async function readJson(request: Request, maxBytes = 24576) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new AppError(415, "Send the request as JSON.")
  }
  const reader = request.body?.getReader()
  if (!reader) throw new AppError(400, "The request body is missing.")
  const decoder = new TextDecoder()
  let text = ""
  let length = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > maxBytes) {
        await reader.cancel()
        throw new AppError(413, "This request is too large.")
      }
      text += decoder.decode(value, { stream: true })
    }
    return JSON.parse(text + decoder.decode())
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new AppError(400, "The request is not valid JSON.")
  } finally {
    reader.releaseLock()
  }
}
