<script setup lang="ts">
import type { DatasetState } from '../services/burnout-dataset'
defineProps<{ result: DatasetState }>()
defineEmits<{ retry: [] }>()
</script>

<template>
  <section class="dataset-coverage" aria-labelledby="dataset-coverage-title" aria-live="polite">
    <h2 id="dataset-coverage-title">Записи для сценария</h2>
    <p v-if="result.state === 'loading'">Загружаем восьминедельный сценарий…</p>
    <p v-else-if="result.state === 'empty'">Набор ещё не опубликован. Недельные графики появятся после подготовки сценария.</p>
    <div v-else-if="result.state === 'error'">
      <p>Не удалось загрузить сценарий. Графики временно недоступны.</p>
      <button type="button" @click="$emit('retry')">Повторить</button>
    </div>
    <template v-else>
      <p>{{ result.dataset.coverage.accepted }} отобрано · {{ result.dataset.coverage.pending }} ожидают проверки · {{ result.dataset.coverage.excluded }} исключено · всего {{ result.dataset.coverage.total }}</p>
      <p class="dataset-coverage__hint">Отбор подтверждает пригодность диалога для примера, а не достаточность данных для оценки выгорания. Даты и шкалы — часть сценария; состав записей не определяет высоту столбцов.</p>
      <details class="dataset-coverage__details">
        <summary>Состав по неделям</summary>
        <ul>
          <li v-for="week in result.dataset.weeklyCoverage" :key="week.index">Неделя {{ week.index + 1 }}: {{ week.accepted }} отобрано, {{ week.pending }} на проверке, {{ week.excluded }} исключено<span v-if="week.accepted"> · {{ Math.round(week.audioSeconds / 60) }} мин аудио</span></li>
        </ul>
      </details>
    </template>
  </section>
</template>
