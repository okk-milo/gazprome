<script setup lang="ts">
import type { TranscriptMessage } from '../types/analysis'

interface TranscriptPanelProps {
  messages: TranscriptMessage[]
}

const props = defineProps<TranscriptPanelProps>()

interface TranscriptTextPart {
  value: string
  highlighted: boolean
}

function getTextParts(message: TranscriptMessage): TranscriptTextPart[] {
  const highlights = [...(message.highlights ?? [])].sort(
    (first, second) => first.startOffset - second.startOffset,
  )

  if (highlights.length === 0) {
    return [{ value: message.text, highlighted: false }]
  }

  const parts: TranscriptTextPart[] = []
  let cursor = 0

  for (const highlight of highlights) {
    const startOffset = Math.max(highlight.startOffset, cursor)
    const endOffset = Math.min(highlight.endOffset, message.text.length)

    if (startOffset >= endOffset) {
      continue
    }

    if (cursor < startOffset) {
      parts.push({
        value: message.text.slice(cursor, startOffset),
        highlighted: false,
      })
    }

    parts.push({
      value: message.text.slice(startOffset, endOffset),
      highlighted: true,
    })
    cursor = endOffset
  }

  if (cursor < message.text.length) {
    parts.push({
      value: message.text.slice(cursor),
      highlighted: false,
    })
  }

  return parts
}
</script>

<template>
  <div class="transcript">
    <article
      v-for="message in props.messages"
      :key="message.id"
      class="transcript__message"
      :class="`transcript__message--${message.role}`"
    >
      <div class="transcript__meta">
        <span>{{ message.speaker }}</span>
        <time>{{ message.timestamp }}</time>
      </div>
      <p>
        <template v-for="(part, index) in getTextParts(message)" :key="message.id + '-' + index">
          <mark v-if="part.highlighted">{{ part.value }}</mark>
          <span v-else>{{ part.value }}</span>
        </template>
      </p>
    </article>
  </div>
</template>
