import { fetchLatestBaileysVersion, fetchLatestWaWebVersion } from './generics'
import type { WAVersion } from '../Types'

export type BestWaVersionResult = {
	version: WAVersion
	isLatest: boolean
	source: 'web.whatsapp.com' | 'github' | 'fallback'
}

const FALLBACK_VERSION: WAVersion = [2, 3000, 1027934701]

export const getBestWaVersion = async (options: RequestInit = {}): Promise<BestWaVersionResult> => {
	try {
		const web = await fetchLatestWaWebVersion(options)
		if (web?.isLatest && web?.version) {
			return { version: web.version, isLatest: true, source: 'web.whatsapp.com' }
		}
	} catch {}

	try {
		const github = await fetchLatestBaileysVersion(options)
		if (github?.isLatest && github?.version) {
			return { version: github.version, isLatest: true, source: 'github' }
		}
	} catch {}

	return { version: FALLBACK_VERSION, isLatest: false, source: 'fallback' }
}
