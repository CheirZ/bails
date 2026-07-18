import fs from 'node:fs'
import path from 'node:path'
import type { ILogger } from './logger'

export type BadMacHandlerOptions = {
	maxRetries?: number
	resetInterval?: number
	authFolder?: string
	logger?: ILogger
}

export class BadMacHandler {
	private errorCount = 0
	private readonly maxRetries: number
	private readonly resetInterval: number
	private lastReset = Date.now()
	private readonly authFolder: string
	private readonly logger?: ILogger

	constructor(options: BadMacHandlerOptions = {}) {
		this.maxRetries = options.maxRetries ?? 5
		this.resetInterval = options.resetInterval ?? 300_000
		this.authFolder = options.authFolder ?? path.resolve(process.cwd(), 'auth_info_baileys')
		this.logger = options.logger
	}

	isBadMacError(error: unknown): boolean {
		const errorMessage = (error as Error)?.message || String(error) || ''
		return (
			errorMessage.includes('Bad MAC') ||
			errorMessage.includes('MAC verification failed') ||
			errorMessage.includes('decryption failed')
		)
	}

	isSessionError(error: unknown): boolean {
		const errorMessage = (error as Error)?.message || String(error) || ''
		return (
			errorMessage.includes('Session') ||
			errorMessage.includes('signal protocol') ||
			errorMessage.includes('decrypt') ||
			this.isBadMacError(error)
		)
	}

	clearProblematicSessionFiles(): boolean {
		try {
			if (!fs.existsSync(this.authFolder)) {
				return false
			}

			const PRESERVE_PATTERNS = ['app-state-sync-key', 'creds.json', 'app-state-sync-version']
			const files = fs.readdirSync(this.authFolder)
			let removedCount = 0

			for (const file of files) {
				const filePath = path.join(this.authFolder, file)
				if (!fs.statSync(filePath).isFile()) continue

				const mustPreserve = PRESERVE_PATTERNS.some(pattern => file.includes(pattern))
				if (mustPreserve) continue

				if (file.startsWith('session-') || file.includes('sender-key')) {
					fs.unlinkSync(filePath)
					removedCount++
				}
			}

			if (removedCount > 0) {
				this.logger?.warn(`${removedCount} problematic session file(s) removed. Main credentials preserved.`)
				return true
			}

			return false
		} catch (error) {
			this.logger?.error({ err: error }, 'Error clearing session files')
			return false
		}
	}

	incrementErrorCount() {
		this.errorCount++
		this.logger?.warn(`Bad MAC error count: ${this.errorCount}/${this.maxRetries}`)

		const now = Date.now()
		if (now - this.lastReset > this.resetInterval) {
			this.resetErrorCount()
		}
	}

	resetErrorCount() {
		const previousCount = this.errorCount
		this.errorCount = 0
		this.lastReset = Date.now()

		if (previousCount > 0) {
			this.logger?.info(`Bad MAC error counter reset. Previous count: ${previousCount}`)
		}
	}

	hasReachedLimit(): boolean {
		return this.errorCount >= this.maxRetries
	}

	handleError(error: unknown, context = 'unknown'): boolean {
		if (!this.isBadMacError(error)) {
			return false
		}

		this.logger?.warn({ err: error, context }, 'Bad MAC error detected')
		this.incrementErrorCount()

		if (this.hasReachedLimit()) {
			this.logger?.error(
				`Bad MAC error limit reached (${this.maxRetries}). Consider restarting the bot or calling clearProblematicSessionFiles().`
			)
			return true
		}

		this.logger?.debug(`Ignoring Bad MAC error and continuing... (${this.errorCount}/${this.maxRetries})`)
		return true
	}

	createSafeWrapper<T extends (...args: any[]) => Promise<any>>(fn: T, context: string): T {
		return (async (...args: any[]) => {
			try {
				return await fn(...args)
			} catch (error) {
				if (this.handleError(error, context)) {
					return null
				}

				throw error
			}
		}) as T
	}

	getStats() {
		return {
			errorCount: this.errorCount,
			maxRetries: this.maxRetries,
			lastReset: new Date(this.lastReset).toISOString(),
			timeUntilReset: Math.max(0, this.resetInterval - (Date.now() - this.lastReset))
		}
	}
}

export const badMacHandler = new BadMacHandler()
