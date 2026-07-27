import { CheckCircle, HelpCircle, Wand2, XCircle } from "lucide-react"
import Image from "next/image"
import { generateNamecheapAffiliateLink } from "@/lib/affiliate-links"
import type { DomainStatus } from "@/lib/domain-status"

interface DomainResultProps {
  domain: string
  status: DomainStatus | null
  isFirstNewBatch?: boolean
  showNewBatchDivider?: boolean
  isHighlighted?: boolean
  isFadingOut?: boolean
  onMoreLikeThis?: (domain: string) => void
}

export function DomainResult({
  domain,
  status,
  isFirstNewBatch,
  showNewBatchDivider,
  isHighlighted = false,
  isFadingOut = false,
  onMoreLikeThis,
}: DomainResultProps) {
  const handleClick = (e: React.MouseEvent) => {
    if (status === 'taken') {
      // Open domain in new tab if taken
      if (e.button === 1 || e.button === 0) {
        window.open(`https://${domain}`, '_blank')
      }
    } else {
      // Copy to clipboard if available
      navigator.clipboard.writeText(domain)
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    // Handle middle click for unavailable domains
    if (e.button === 1 && status === 'taken') {
      e.preventDefault()
      window.open(`https://${domain}`, '_blank')
    }
  }

  const registrars = [
    {
      name: 'Porkbun',
      logo: '/porkbun-logo.svg',
      url: `https://porkbun.com/checkout/search?q=${domain}`,
      width: 24,
      height: 24
    },
    {
      name: 'Namecheap',
      logo: '/namecheap-logo.svg',
      url: generateNamecheapAffiliateLink(domain),
      width: 80,
      height: 16
    }
  ]

  return (
    <>
      {showNewBatchDivider && isFirstNewBatch && (
        <div className="flex items-center gap-3 py-3">
          <div className="flex-1 h-px bg-gray-200"></div>
          <span className="text-xs text-gray-400 font-light">New suggestions</span>
          <div className="flex-1 h-px bg-gray-200"></div>
        </div>
      )}
      <div
        className={`group px-4 py-2.5 text-gray-600 hover:bg-gray-50 rounded-md transition-colors duration-150 border border-transparent hover:border-gray-200 font-light ${
          isHighlighted && !isFadingOut ? 'highlight-unseen' : ''
        } ${isFadingOut ? 'highlight-fade-out' : ''}`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={`cursor-pointer truncate ${status === 'taken' ? 'text-gray-400 underline' : 'text-gray-700'}`}
              onClick={handleClick}
              onMouseDown={handleMouseDown}
              title={status === 'taken' ? "Click to visit" : "Click to copy"}
            >
              {domain}
            </span>
            {onMoreLikeThis && status === 'available' && (
              <button
                type="button"
                onClick={() => onMoreLikeThis(domain)}
                title="Search for names like this one"
                aria-label={`Search for names like ${domain}`}
                className="cursor-pointer text-gray-300 opacity-0 transition-opacity hover:text-purple-500 focus-visible:opacity-100 group-hover:opacity-100"
              >
                <Wand2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {status === null ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <div className="w-1 h-1 bg-gray-400 rounded-full loading-dot"></div>
                <div className="w-1 h-1 bg-gray-400 rounded-full loading-dot" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-1 h-1 bg-gray-400 rounded-full loading-dot" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          ) : status === 'available' ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {registrars.map((registrar) => (
                  <a
                    key={registrar.name}
                    href={registrar.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center opacity-60 hover:opacity-100 transition-opacity"
                    title={`Buy on ${registrar.name}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Image
                      src={registrar.logo}
                      alt={registrar.name}
                      width={registrar.width}
                      height={registrar.height}
                      className="h-4 w-auto object-contain"
                    />
                  </a>
                ))}
              </div>
              <div className="flex items-center gap-1 text-green-600">
                <CheckCircle className="w-4 h-4" />
                <span className="text-xs font-normal">Available</span>
              </div>
            </div>
          ) : status === 'taken' ? (
            <div className="flex items-center gap-1 text-red-500">
              <XCircle className="w-4 h-4" />
              <span className="text-xs font-normal">Taken</span>
            </div>
          ) : (
            // Registries throttle and time out. Saying so beats guessing "Taken"
            // and quietly hiding a name that may well be free.
            <div
              className="flex items-center gap-1 text-amber-500"
              title="The registry did not give a clear answer — try again in a moment"
            >
              <HelpCircle className="w-4 h-4" />
              <span className="text-xs font-normal">Unknown</span>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
