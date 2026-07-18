export const S_WHATSAPP_NET = '@s.whatsapp.net'
export const OFFICIAL_BIZ_JID = '16505361212@c.us'
export const SERVER_JID = 'server@c.us'
export const PSA_WID = '0@c.us'
export const STORIES_JID = 'status@broadcast'
export const META_AI_JID = '13135550002@c.us'

export type JidServer =
	| 'c.us'
	| 'g.us'
	| 'broadcast'
	| 's.whatsapp.net'
	| 'call'
	| 'lid'
	| 'newsletter'
	| 'bot'
	| 'hosted'
	| 'hosted.lid'

export enum WAJIDDomains {
	WHATSAPP = 0,
	LID = 1,
	HOSTED = 128,
	HOSTED_LID = 129
}

export type JidWithDevice = {
	user: string
	device?: number
}

export type FullJid = JidWithDevice & {
	server: JidServer
	domainType?: number
}

export const getServerFromDomainType = (initialServer: string, domainType?: WAJIDDomains): JidServer => {
	switch (domainType) {
		case WAJIDDomains.LID:
			return 'lid'
		case WAJIDDomains.HOSTED:
			return 'hosted'
		case WAJIDDomains.HOSTED_LID:
			return 'hosted.lid'
		case WAJIDDomains.WHATSAPP:
		default:
			return initialServer as JidServer
	}
}

export const jidEncode = (user: string | number | null, server: JidServer, device?: number, agent?: number) => {
	return `${user || ''}${!!agent ? `_${agent}` : ''}${!!device ? `:${device}` : ''}@${server}`
}

export const jidDecode = (jid: string | undefined): FullJid | undefined => {
	// todo: investigate how to implement hosted ids in this case
	const sepIdx = typeof jid === 'string' ? jid.indexOf('@') : -1
	if (sepIdx < 0) {
		return undefined
	}

	const server = jid!.slice(sepIdx + 1)
	const userCombined = jid!.slice(0, sepIdx)

	const [userAgent, device] = userCombined.split(':')
	const [user, agent] = userAgent!.split('_')

	let domainType = WAJIDDomains.WHATSAPP
	if (server === 'lid') {
		domainType = WAJIDDomains.LID
	} else if (server === 'hosted') {
		domainType = WAJIDDomains.HOSTED
	} else if (server === 'hosted.lid') {
		domainType = WAJIDDomains.HOSTED_LID
	} else if (agent) {
		domainType = parseInt(agent)
	}

	return {
		server: server as JidServer,
		user: user!,
		domainType,
		device: device ? +device : undefined
	}
}

/** is the jid a user */
export const areJidsSameUser = (jid1: string | undefined, jid2: string | undefined) =>
	jidDecode(jid1)?.user === jidDecode(jid2)?.user
/** is the jid Meta AI */
export const isJidMetaAI = (jid: string | undefined) => jid?.endsWith('@bot')
/** is the jid a PN user */
export const isPnUser = (jid: string | undefined) => jid?.endsWith('@s.whatsapp.net')
/** is the jid a LID */
export const isLidUser = (jid: string | undefined) => jid?.endsWith('@lid')
/** is the jid a broadcast */
export const isJidBroadcast = (jid: string | undefined) => jid?.endsWith('@broadcast')
/** is the jid a group */
export const isJidGroup = (jid: string | undefined) => jid?.endsWith('@g.us')
/** is the jid the status broadcast */
export const isJidStatusBroadcast = (jid: string) => jid === 'status@broadcast'
/** is the jid a newsletter */
export const isJidNewsletter = (jid: string | undefined) => jid?.endsWith('@newsletter')
/** is the jid a hosted PN */
export const isHostedPnUser = (jid: string | undefined) => jid?.endsWith('@hosted')
/** is the jid a hosted LID */
export const isHostedLidUser = (jid: string | undefined) => jid?.endsWith('@hosted.lid')

const botRegexp = /^1313555\d{4}$|^131655500\d{2}$/

export const isJidBot = (jid: string | undefined) => jid && botRegexp.test(jid.split('@')[0]!) && jid.endsWith('@c.us')

export const jidNormalizedUser = (jid: string | undefined) => {
	const result = jidDecode(jid)
	if (!result) {
		return ''
	}

	const { user, server } = result
	return jidEncode(user, server === 'c.us' ? 's.whatsapp.net' : (server as JidServer))
}

export const transferDevice = (fromJid: string, toJid: string) => {
	const fromDecoded = jidDecode(fromJid)
	const deviceId = fromDecoded?.device || 0
	const { server, user } = jidDecode(toJid)!
	return jidEncode(user, server, deviceId)
}


type LRUEntry = { value: string; expires: number }

class SimpleLRU {
	private map = new Map<string, LRUEntry>()

	constructor(
		private maxSize: number,
		private ttlMs: number
	) {}

	get(key: string): string | undefined {
		const entry = this.map.get(key)
		if (!entry) return undefined
		if (Date.now() > entry.expires) {
			this.map.delete(key)
			return undefined
		}

		this.map.delete(key)
		this.map.set(key, entry)
		return entry.value
	}

	set(key: string, value: string) {
		this.map.delete(key)
		this.map.set(key, { value, expires: Date.now() + this.ttlMs })
		if (this.map.size > this.maxSize) {
			const lru = this.map.keys().next().value
			if (lru) this.map.delete(lru)
		}
	}
}

const lidToJidCache = new SimpleLRU(2000, 5 * 60 * 1000)

const _sharedLidPhoneMap = new Map<string, string>()
const SHARED_MAP_MAX_SIZE = 3000

export const sharedLidPhoneCache = {
	set(lid: string | undefined, phoneJid: string | undefined) {
		if (!lid || !phoneJid || typeof lid !== 'string' || typeof phoneJid !== 'string') return
		if (!phoneJid.includes('@')) phoneJid = phoneJid + S_WHATSAPP_NET

		if (_sharedLidPhoneMap.size > SHARED_MAP_MAX_SIZE * 2) {
			const it = _sharedLidPhoneMap.keys()
			const toRemove = Math.floor(_sharedLidPhoneMap.size * 0.25)
			for (let i = 0; i < toRemove; i++) {
				const k = it.next().value
				if (k === undefined) break
				_sharedLidPhoneMap.delete(k)
			}
		}

		_sharedLidPhoneMap.set(lid, phoneJid)
		_sharedLidPhoneMap.set(phoneJid, lid)
		lidToJidCache.set(lid, phoneJid)
	},
	get(key: string | undefined): string | undefined {
		if (!key) return undefined
		return _sharedLidPhoneMap.get(key)
	},
	getLidForPhone(phoneJid: string | undefined): string | undefined {
		if (!phoneJid) return undefined
		const val = _sharedLidPhoneMap.get(phoneJid)
		return val && val.endsWith('@lid') ? val : undefined
	},
	getPhoneForLid(lid: string | undefined): string | undefined {
		if (!lid) return undefined
		const val = _sharedLidPhoneMap.get(lid)
		return val && val.endsWith(S_WHATSAPP_NET) ? val : undefined
	},
	get size() {
		return _sharedLidPhoneMap.size
	}
}

export const lidToJid = (jid: string | undefined): string | undefined => {
	try {
		if (!jid || typeof jid !== 'string') return jid

		const cached = lidToJidCache.get(jid)
		if (cached) return cached

		let result = jid
		if (jid.endsWith('@lid')) {
			const phoneFromCache = sharedLidPhoneCache.getPhoneForLid(jid)
			if (phoneFromCache) result = phoneFromCache
		}

		if (result !== jid) lidToJidCache.set(jid, result)
		return result
	} catch {
		return jid
	}
}

export const resolveJid = (jid: string | undefined): string | undefined => {
	if (typeof jid === 'string' && jid.endsWith('@lid')) return lidToJid(jid)
	return jid
}

export const normalizeJid = (jid: string | undefined): string | undefined => {
	if (!jid || typeof jid !== 'string') return jid
	if (jid.startsWith('@')) return jid
	if (jid.endsWith('@lid')) return lidToJid(jid)
	if (jid.endsWith(S_WHATSAPP_NET) || jid.endsWith('@g.us') || jid.endsWith('@newsletter')) return jid
	if (/^\d+$/.test(jid)) return jid + S_WHATSAPP_NET
	if (jid.endsWith('@c.us')) return jid.replace('@c.us', S_WHATSAPP_NET)
	return jid
}

export const resolveAll = (jid: string | undefined): { jid: string | undefined; lid: string | undefined } => {
	if (!jid || typeof jid !== 'string') return { jid, lid: undefined }

	if (jid.endsWith('@lid')) {
		const resolved = lidToJid(jid)
		return { jid: resolved !== jid ? resolved : undefined, lid: jid }
	}

	if (jid.endsWith(S_WHATSAPP_NET)) {
		return { jid, lid: sharedLidPhoneCache.getLidForPhone(jid) }
	}

	return { jid: normalizeJid(jid), lid: undefined }
}

const VALID_JID_SERVERS = new Set(['s.whatsapp.net', 'g.us', 'lid', 'broadcast', 'newsletter', 'c.us', 'bot', 'hosted', 'hosted.lid'])

export const validateJid = (jid: string | undefined): { isValid: boolean; error: string | null } => {
	if (!jid || typeof jid !== 'string') return { isValid: false, error: 'JID is null or not a string' }
	if (!jid.includes('@')) return { isValid: false, error: 'Missing @ separator' }

	const [user, server] = jid.split('@')
	if (!user) return { isValid: false, error: 'Empty user part' }
	if (!server || !VALID_JID_SERVERS.has(server)) return { isValid: false, error: `Unknown server: ${server}` }

	return { isValid: true, error: null }
}
