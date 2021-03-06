import {
	ButtonStyle,
	ActionRowBuilder,
	ButtonBuilder, CommandInteraction,
	GuildMember,
	InteractionCollector,
	Message, WebhookEditMessageOptions, MessageEditOptions, MessageOptions, MessagePayload, MessageActionRowComponentBuilder
} from 'discord.js'
import emojis from '../assets/emojis'


export default class Paginator<T> {
	member: GuildMember
	data: T[]
	payloadGenerator: (data: T, page: number) => Promise<MessageEditOptions>
	page: number
	message?: Message
	interactionCollector?: InteractionCollector<any>
	timeout?: NodeJS.Timeout

	constructor({ member, data, payloadGenerator, config }: {
		member: GuildMember,
		data: T[],
		payloadGenerator: (data: T, page: number) => Promise<MessageEditOptions>,
		config?: {
			page?: number
		}
	}) {
		this.member = member
		this.data = data
		this.payloadGenerator = payloadGenerator
		this.page = config?.page ?? 0
	}

	get pagesLength() {
		return this.data.length
	}

	async init(interaction: CommandInteraction) {
		const payload = await this.payloadGenerator(this.data[this.page], this.page)

		payload.components
			? payload.components.unshift(this.getNavigationButtons(this.page))
			: payload.components = [this.getNavigationButtons(this.page)]

		this.startTimeout(60 * 1000)

		// @ts-expect-error
		await interaction.reply(payload)
		this.message = await interaction.fetchReply() as Message

		this.interactionCollector = this.message.createMessageComponentCollector({
			filter: (i) => i.user.id === this.member.id
		})

		this.interactionCollector.on('collect', async (i) => {
			this.timeout!.refresh()
			if(i.customId === 'paginationLeft') {
				await this.swipeTo(
					this.page - 1 >= 0
						? this.page - 1
						: this.pagesLength - 1
				)
				i.deferUpdate()
			}
			if(i.customId === 'paginationRight') {
				await this.swipeTo(
					this.page + 1 < this.pagesLength
						? this.page + 1
						: 0
				)
				i.deferUpdate()
			}
		})

		return this.message
	}

	async swipeTo(page: number) {
		this.page = page
		const payload = await this.payloadGenerator(this.data[this.page], this.page)

		payload.components
			? payload.components.unshift(this.getNavigationButtons(this.page))
			: payload.components = [this.getNavigationButtons(this.page)]

		await this.message!.edit(payload)
	}

	getNavigationButtons(page: number) {
		return new ActionRowBuilder<MessageActionRowComponentBuilder>()
			.addComponents([
				new ButtonBuilder()
					.setStyle(ButtonStyle.Secondary)
					.setEmoji(emojis.chevron.left)
					.setCustomId('paginationLeft'),
				new ButtonBuilder()
					.setStyle(ButtonStyle.Secondary)
					.setLabel(`${page + 1} / ${this.pagesLength}`)
					.setCustomId('paginationPageLabel')
					.setDisabled(true),
				new ButtonBuilder()
					.setStyle(ButtonStyle.Secondary)
					.setEmoji(emojis.chevron.right)
					.setCustomId('paginationRight')
			])
	}

	startTimeout(duration: number) {
		this.timeout = setTimeout(() => {
			this.interactionCollector!.stop()
		}, duration)
	}
}
