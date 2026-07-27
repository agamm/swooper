import { describe, it, expect } from 'vitest'
import { validateDomainQuery, isUsableSuggestion, repairSuggestion } from '@/lib/validate-query'

describe('validateDomainQuery', () => {
  it('accepts an empty query so a blank box is not an error', () => {
    expect(validateDomainQuery('').isValid).toBe(true)
    expect(validateDomainQuery('   ').isValid).toBe(true)
  })

  it('accepts plain and patterned domains', () => {
    for (const query of ['example.com', 'fire(animals).com', '(get/use)app.(com/io)', 'my-app.co.uk']) {
      expect(validateDomainQuery(query), query).toMatchObject({ isValid: true })
    }
  })

  it('rejects unbalanced parentheses', () => {
    expect(validateDomainQuery('fire(animals.com').isValid).toBe(false)
    expect(validateDomainQuery('fireanimals).com').isValid).toBe(false)
  })

  it('rejects an empty slot', () => {
    expect(validateDomainQuery('fire().com').isValid).toBe(false)
    expect(validateDomainQuery('fire(  ).com').isValid).toBe(false)
  })

  it('rejects characters that are illegal outside a slot', () => {
    const result = validateDomainQuery('get/use.com')
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('/')
  })

  it('allows those same characters inside a slot', () => {
    expect(validateDomainQuery('(get/use).com').isValid).toBe(true)
    expect(validateDomainQuery('(two words with spaces).com').isValid).toBe(true)
  })

  it('caps the number of slots at four', () => {
    expect(validateDomainQuery('(a)(b)(c)(d).com').isValid).toBe(true)
    expect(validateDomainQuery('(a)(b)(c)(d)(e).com').isValid).toBe(false)
  })
})

describe('isUsableSuggestion', () => {
  it('accepts patterns the search box can expand', () => {
    for (const pattern of ['fire(animals).com', '(action words)app.(com/io)', '(one word).ai']) {
      expect(isUsableSuggestion(pattern), pattern).toBe(true)
    }
  })

  it('rejects a name with no slot to expand', () => {
    expect(isUsableSuggestion('example.com')).toBe(false)
  })

  it('rejects a pattern with no TLD', () => {
    expect(isUsableSuggestion('(animals)')).toBe(false)
    expect(isUsableSuggestion('fire(animals)')).toBe(false)
    expect(isUsableSuggestion('fire(animals).')).toBe(false)
  })

  it('rejects anything the base validator already refuses', () => {
    expect(isUsableSuggestion('get/use.com')).toBe(false)
    expect(isUsableSuggestion('fire(animals.com')).toBe(false)
  })

  it('tolerates surrounding whitespace', () => {
    expect(isUsableSuggestion('  fire(animals).com  ')).toBe(true)
  })
})

describe('repairSuggestion', () => {
  it('passes through a pattern that is already valid', () => {
    expect(repairSuggestion('fire(animals).com')).toBe('fire(animals).com')
  })

  it('inserts the missing dot before a trailing TLD slot', () => {
    expect(repairSuggestion('(short invented word)(io/co)')).toBe('(short invented word).(io/co)')
    expect(repairSuggestion('myapp(com/io/ai)')).toBe('myapp.(com/io/ai)')
  })

  it('leaves an existing dot before the TLD slot alone', () => {
    expect(repairSuggestion('(action words)app.(com/io)')).toBe('(action words)app.(com/io)')
  })

  it('does not invent a TLD from a trailing slot that is not one', () => {
    // "(adj)(noun)" would become the nonsense TLD ".(noun)" if repaired.
    expect(repairSuggestion('(adjective)(noun)')).toBeNull()
  })

  it('strips quotes, stray spaces and trailing dots', () => {
    expect(repairSuggestion('"fire(animals).com"')).toBe('fire(animals).com')
    expect(repairSuggestion('fire(animals) .com')).toBe('fire(animals).com')
    expect(repairSuggestion('fire(animals).com.')).toBe('fire(animals).com')
  })

  it('keeps spaces inside a slot, where they are meaningful', () => {
    expect(repairSuggestion('(two cybersecurity terms).ai')).toBe('(two cybersecurity terms).ai')
  })

  it('returns null when no repair makes it usable', () => {
    expect(repairSuggestion('')).toBeNull()
    expect(repairSuggestion('just a sentence')).toBeNull()
    expect(repairSuggestion('example.com')).toBeNull()
  })
})
