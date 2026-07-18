import { getContentType } from './messages'
import type { WAMessage, WAMessageUpdate } from '../Types'
import type { ILogger } from './logger'

const MEDIA_MESSAGE_TYPES = new Set(['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage', 'ptvMessage'])

export type StarredMediaForwarderOptions = {
	targetJid: string
	getMessage: (key: WAMessage['key']) => Promise<WAMessage | undefined>
	sendMessage: (jid: string, content: { forward: WAMessage; force?: boolean }) => Promise<unknown>
	mediaTypes?: Set<string>
	logger?: ILogger
}

export const attachStarredMediaForwarder = (
	ev: {
		on: (event: 'messages.update', cb: (updates: WAMessageUpdate[]) => void) => void
		off: (event: 'messages.update', cb: (updates: WAMessageUpdate[]) => void) => void
	},
	options: StarredMediaForwarderOptions
) => {
	const mediaTypes = options.mediaTypes ?? MEDIA_MESSAGE_TYPES

	const handler = async (updates: WAMessageUpdate[]) => {
		for (const { key, update } of updates) {
			if (!update.starred) continue

			try {
				const fullMessage = await options.getMessage(key)
				if (!fullMessage?.message) {
					options.logger?.debug({ key }, 'starred-media-forwarder: full message unavailable, skipping')
					continue
				}

				const type = getContentType(fullMessage.message)
				if (!type || !mediaTypes.has(type)) continue

				await options.sendMessage(options.targetJid, { forward: fullMessage })
				options.logger?.info({ key, type }, 'starred-media-forwarder: forwarded to channel')
			} catch (err) {
				options.logger?.warn({ err, key }, 'starred-media-forwarder: failed to forward')
			}
		}
	}

	ev.on('messages.update', handler)
	return () => ev.off('messages.update', handler)
}
