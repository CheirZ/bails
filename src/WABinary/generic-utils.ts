import { Boom } from '@hapi/boom'
import { randomBytes } from 'crypto'
import { proto } from '../../WAProto/index.js'
import { type BinaryNode } from './types'

// some extra useful utilities

const indexCache = new WeakMap<BinaryNode, Map<string, BinaryNode[]>>()

export const getBinaryNodeChildren = (node: BinaryNode | undefined, childTag: string) => {
	if (!node || !Array.isArray(node.content)) return []

	let index = indexCache.get(node)

	// Build the index once per node
	if (!index) {
		index = new Map<string, BinaryNode[]>()

		for (const child of node.content) {
			let arr = index.get(child.tag)
			if (!arr) index.set(child.tag, (arr = []))
			arr.push(child)
		}

		indexCache.set(node, index)
	}

	// Return first matching child
	return index.get(childTag) || []
}

export const getBinaryNodeChild = (node: BinaryNode | undefined, childTag: string) => {
	return getBinaryNodeChildren(node, childTag)[0]
}

export const getAllBinaryNodeChildren = ({ content }: BinaryNode) => {
	if (Array.isArray(content)) {
		return content
	}

	return []
}

export const getBinaryNodeChildBuffer = (node: BinaryNode | undefined, childTag: string) => {
	const child = getBinaryNodeChild(node, childTag)?.content
	if (Buffer.isBuffer(child) || child instanceof Uint8Array) {
		return child
	}
}

export const getBinaryNodeChildString = (node: BinaryNode | undefined, childTag: string) => {
	const child = getBinaryNodeChild(node, childTag)?.content
	if (Buffer.isBuffer(child) || child instanceof Uint8Array) {
		return Buffer.from(child).toString('utf-8')
	} else if (typeof child === 'string') {
		return child
	}
}

export const getBinaryNodeChildUInt = (node: BinaryNode, childTag: string, length: number) => {
	const buff = getBinaryNodeChildBuffer(node, childTag)
	if (buff) {
		return bufferToUInt(buff, length)
	}
}

export const assertNodeErrorFree = (node: BinaryNode) => {
	const errNode = getBinaryNodeChild(node, 'error')
	if (errNode) {
		throw new Boom(errNode.attrs.text || 'Unknown error', { data: +errNode.attrs.code! })
	}
}

export const reduceBinaryNodeToDictionary = (node: BinaryNode, tag: string) => {
	const nodes = getBinaryNodeChildren(node, tag)
	const dict = nodes.reduce(
		(dict, { attrs }) => {
			if (typeof attrs.name === 'string') {
				dict[attrs.name] = attrs.value! || attrs.config_value!
			} else {
				dict[attrs.config_code!] = attrs.value! || attrs.config_value!
			}

			return dict
		},
		{} as { [_: string]: string }
	)
	return dict
}

export const getBinaryNodeMessages = ({ content }: BinaryNode) => {
	const msgs: proto.WebMessageInfo[] = []
	if (Array.isArray(content)) {
		for (const item of content) {
			if (item.tag === 'message') {
				msgs.push(proto.WebMessageInfo.decode(item.content as Buffer).toJSON() as proto.WebMessageInfo)
			}
		}
	}

	return msgs
}

function bufferToUInt(e: Uint8Array | Buffer, t: number) {
	let a = 0
	for (let i = 0; i < t; i++) {
		a = 256 * a + e[i]!
	}

	return a
}

const tabs = (n: number) => '\t'.repeat(n)

export function binaryNodeToString(node: BinaryNode | BinaryNode['content'], i = 0): string {
	if (!node) {
		return node!
	}

	if (typeof node === 'string') {
		return tabs(i) + node
	}

	if (node instanceof Uint8Array) {
		return tabs(i) + Buffer.from(node).toString('hex')
	}

	if (Array.isArray(node)) {
		return node.map(x => tabs(i + 1) + binaryNodeToString(x, i + 1)).join('\n')
	}

	const children = binaryNodeToString(node.content, i + 1)

	const tag = `<${node.tag} ${Object.entries(node.attrs || {})
		.filter(([, v]) => v !== undefined)
		.map(([k, v]) => `${k}='${v}'`)
		.join(' ')}`

	const content: string = children ? `>\n${children}\n${tabs(i)}</${node.tag}>` : '/>'

	return tag + content
}

const FLOWS_MAP: Record<string, true> = {
	mpm: true,
	cta_catalog: true,
	send_location: true,
	call_permission_request: true,
	wa_payment_transaction_details: true,
	automated_greeting_message_view_catalog: true,
	card_message: true,
	order_status: true,
	track_order: true,
	reorder: true,
	cancel_order: true,
	clear_chat: true,
	navigateToScreen: true,
	payment_status: true,
	payment_method: true,
	flow_action: true,
	voice_call: true,
	video_call_button: true,
	otp_button: true,
	authentication_button: true,
	single_select: true
}

const ORDER_RESPONSE_ALIAS: Record<string, string> = {
	review_and_pay: 'order_details',
	review_order: 'order_status',
	payment_info: 'payment_info',
	payment_status: 'payment_status',
	payment_method: 'payment_method',
	order_details: 'order_details',
	order_status: 'order_status',
	track_order: 'track_order',
	reorder: 'reorder',
	cancel_order: 'cancel_order'
}

const DECISION_SOURCE_CONTENT: BinaryNode[] = [{ tag: 'decision_source', attrs: { value: 'df' } }]

const LIST_TYPE_CONTENT: BinaryNode = { tag: 'list', attrs: { v: '2', type: 'product_list' } }

const NATIVE_FLOW_ATTRIBUTE = { type: 'native_flow', v: '1' }

const MIXED_NATIVE_FLOW: BinaryNode = {
	tag: 'interactive',
	attrs: NATIVE_FLOW_ATTRIBUTE,
	content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }]
}

export const getBizBinaryNode = (message: any): BinaryNode => {
	const flowMsg = message.interactiveMessage?.nativeFlowMessage
	const firstButtonName = flowMsg?.buttons?.[0]?.name

	const qualityContent: BinaryNode = {
		tag: 'quality_control',
		attrs: { decision_id: randomBytes(20).toString('hex'), source_type: 'third_party' },
		content: DECISION_SOURCE_CONTENT
	}

	const bizAttributes: Record<string, string> = {
		actual_actors: '2',
		host_storage: '2',
		privacy_mode_ts: `${(Date.now() / 1_000) | 0}`
	}

	if (firstButtonName && ORDER_RESPONSE_ALIAS[firstButtonName]) {
		bizAttributes.native_flow_name = ORDER_RESPONSE_ALIAS[firstButtonName]!
		return { tag: 'biz', attrs: bizAttributes, content: [qualityContent] }
	}

	if (firstButtonName && FLOWS_MAP[firstButtonName]) {
		return {
			tag: 'biz',
			attrs: bizAttributes,
			content: [
				{
					tag: 'interactive',
					attrs: NATIVE_FLOW_ATTRIBUTE,
					content: [{ tag: 'native_flow', attrs: { v: '2', name: firstButtonName } }]
				},
				qualityContent
			]
		}
	}

	if (flowMsg || message.buttonsMessage || message.templateMessage) {
		return { tag: 'biz', attrs: bizAttributes, content: [MIXED_NATIVE_FLOW, qualityContent] }
	}

	if (message.listMessage) {
		return { tag: 'biz', attrs: bizAttributes, content: [LIST_TYPE_CONTENT, qualityContent] }
	}

	return { tag: 'biz', attrs: bizAttributes, content: [qualityContent] }
}
