export class Semaphore {
  private queue: Array<() => void> = []
  private running = 0
  private nextSlot = 0

  constructor(
    private maxConcurrent: number,
    private minInterval?: number,
  ) {}

  async acquire(): Promise<void> {
    if (this.running >= this.maxConcurrent) {
      // release() hands its slot straight to us, so `running` already counts us.
      await new Promise<void>((resolve) => this.queue.push(resolve))
    } else {
      this.running++
    }

    if (this.minInterval !== undefined) {
      // Reserve this caller's slot before awaiting. Reading the timestamp and
      // writing it after the sleep would let concurrent acquirers all observe
      // the same last-run time and fire together, defeating the interval.
      const now = Date.now()
      const runAt = Math.max(now, this.nextSlot)
      this.nextSlot = runAt + this.minInterval
      if (runAt > now) {
        await new Promise((resolve) => setTimeout(resolve, runAt - now))
      }
    }
  }

  release(): void {
    const next = this.queue.shift()
    if (next) {
      next() // Pass the slot along; `running` stays put.
    } else {
      this.running--
    }
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire()
    try {
      return await fn()
    } finally {
      this.release()
    }
  }
}
