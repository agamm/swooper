import DomainGenerator from "../domain-generator"
import Link from "next/link"
import { Suspense } from "react"
import { MODEL_DISPLAY_NAME } from "@/lib/generate-options"
import { GITHUB_URL, OPENROUTER_KEYS_URL, VERCEL_DEPLOY_URL } from "@/lib/links"
import { GitHubIcon } from "@/components/github-icon"
import { LANDING_ONLY } from "@/lib/config"

function HostedLanding() {
  return (
    <div className="flex flex-col items-center gap-6 max-w-md text-center">
      <p className="text-gray-500 font-light text-lg">
        Describe the domain you want — AI fills the blanks and shows only the ones that are free.
      </p>
      <p className="text-sm text-gray-500 font-light">
        This is the open-source showcase. To keep it free, the hosted search is off — deploy your
        own copy with your own{" "}
        <a
          href={OPENROUTER_KEYS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-700 underline underline-offset-2 hover:text-gray-900 transition-colors"
        >
          OpenRouter
        </a>{" "}
        key (a fraction of a cent per search).
      </p>
      <div className="flex flex-wrap items-center justify-center gap-4">
        <a href={VERCEL_DEPLOY_URL} target="_blank" rel="noopener noreferrer" aria-label="Deploy with Vercel">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="https://vercel.com/button" alt="Deploy with Vercel" height={32} className="h-8" />
        </a>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <GitHubIcon className="w-4 h-4" />
          View on GitHub
        </a>
      </div>
      <Link href="/deploy" className="text-xs text-gray-400 hover:text-gray-600 font-light transition-colors">
        Setup guide →
      </Link>
    </div>
  )
}

export default function Page() {
  return (
    <div className="min-h-screen flex flex-col font-[family-name:var(--font-geist-sans)]">
      <main className="flex-grow flex flex-col p-8 sm:p-20">
        <div className="flex flex-col gap-8 items-center pt-20">
          <Link href="/" className="text-5xl font-extralight tracking-tight text-gray-900 hover:text-gray-700 transition-colors cursor-pointer">
            <h1>Swooper</h1>
          </Link>
          {LANDING_ONLY ? (
            <HostedLanding />
          ) : (
            <>
              <p className="text-gray-500 text-center max-w-md font-light text-lg">
                Ready to find a really good domain name?
              </p>
              <Suspense fallback={<div className="animate-pulse h-12 w-96 bg-gray-100 rounded-md"></div>}>
                <DomainGenerator />
              </Suspense>
            </>
          )}
        </div>
      </main>

      <footer className="px-4 py-8 flex flex-col items-center gap-3">
        <div className="flex gap-4 justify-center">
          <Link
            href="/faq"
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            FAQ
          </Link>
          <span className="text-sm text-gray-400">•</span>
          <Link
            href="/deploy"
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Self-host
          </Link>
          <span className="text-sm text-gray-400">•</span>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <GitHubIcon className="w-3.5 h-3.5" />
            GitHub
          </a>
        </div>
        <p className="text-xs text-gray-400 font-light">{MODEL_DISPLAY_NAME}</p>
      </footer>
    </div>
  )
}
