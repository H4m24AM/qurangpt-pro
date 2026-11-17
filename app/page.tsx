import { StudyDesk } from "./study-desk"

export default async function Home({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const { q } = await searchParams
  return (
    <>
      <header className="site-header">
        <a href="/" className="brand">QuranGPT <span>Pro</span></a>
        <a href="https://tech.hamza.am/?intro=0" className="desktop-link">Hamza.AM Desktop</a>
      </header>
      <StudyDesk initialQuery={typeof q === "string" ? q.slice(0, 240) : ""} />
      <footer>QuranGPT Pro by Hamza.AM <span>·</span> A study aid with links to source material.</footer>
    </>
  )
}
