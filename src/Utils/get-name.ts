import { isLidUser, jidDecode, lidToJid, sharedLidPhoneCache } from '../WABinary'
import type { proto } from '../../WAProto/index.js'

export type ContactStoreEntry = {
	name?: string
	notify?: string
	verifiedName?: string
}

export type ContactStoreLike = Record<string, ContactStoreEntry | undefined>

export const getName = (msg: proto.IWebMessageInfo | undefined, contactStore?: ContactStoreLike): string => {
	try {
		const key = msg?.key || {}
		const sender = key.participant || key.remoteJid || ''

		let resolvedSender = sender
		if (isLidUser(sender)) {
			const phone = sharedLidPhoneCache.getPhoneForLid(sender) || lidToJid(sender)
			if (phone && phone !== sender) resolvedSender = phone
		}

		const contact = contactStore?.[resolvedSender] || contactStore?.[sender]
		if (contact?.name && contact.name.trim()) return contact.name.trim()

		if (contact?.verifiedName && contact.verifiedName.trim()) return contact.verifiedName.trim()

		const pushName = msg?.pushName || contact?.notify
		if (pushName && pushName.trim() && pushName.trim() !== 'WhatsApp User') {
			return pushName.trim()
		}

		const decoded = jidDecode(resolvedSender)
		if (decoded?.user) {
			return `+${decoded.user}`
		}

		return 'Unknown user'
	} catch {
		return 'Unknown user'
	}
}
