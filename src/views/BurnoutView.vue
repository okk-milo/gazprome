<script setup lang="ts">
import ContextPills from '../components/ContextPills.vue'
import DecisionPanel from '../components/DecisionPanel.vue'
import EvidenceList from '../components/EvidenceList.vue'
import MetricTile from '../components/MetricTile.vue'
import PeriodComparison from '../components/PeriodComparison.vue'
import SectionCard from '../components/SectionCard.vue'
import { burnoutDemoData as analysis } from '../data/burnout'
import '../burnout.css'
</script>

<template>
  <section class="burnout-demo" aria-label="Демонстрационная оценка выгорания">
    <ContextPills :items="analysis.context" />

    <DecisionPanel
      label="Итог наблюдения"
      title="Состояние изменилось относительно личной нормы"
      :score="analysis.decision.result.score"
      tone="warning"
      :summary="analysis.decision.summary"
      :recommendation="analysis.decision.recommendation"
    />

    <SectionCard :title="analysis.trajectory.label" :description="analysis.trajectory.description">
      <PeriodComparison :series="analysis.trajectory.series" :labels="analysis.trajectory.xAxisLabels" />
    </SectionCard>

    <div class="burnout-columns">
      <div class="burnout-columns__column">
        <SectionCard
          title="Шкалы состояния"
          description="Значения показывают отклонение от собственной нормы сотрудника, а не сравнение с коллегами"
        >
          <div class="metric-grid">
            <MetricTile v-for="item in analysis.metrics" :key="item.id" :item="item" />
          </div>
        </SectionCard>
        <SectionCard
          title="Контекст нагрузки"
          description="Нагрузка учитывается как контроль, но не приравнивается к состоянию сотрудника"
        >
          <div class="workload-list">
            <MetricTile v-for="item in analysis.workload" :key="item.id" :item="item" />
          </div>
        </SectionCard>
      </div>

      <div class="burnout-columns__column">
        <SectionCard title="Что изменилось" description="Наблюдаемые речевые признаки и их вклад в текущий сигнал">
          <EvidenceList :items="analysis.evidence" />
        </SectionCard>
        <SectionCard title="Что можно сделать" description="Рекомендации для руководителя и HR">
          <ol class="recommendation-list">
            <li v-for="(action, index) in analysis.actions" :key="action">
              <span>{{ index + 1 }}</span><p>{{ action }}</p>
            </li>
          </ol>
        </SectionCard>
      </div>
    </div>
  </section>
</template>
