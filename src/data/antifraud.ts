import type { AntifraudAnalysis } from '../types/analysis'

export const antifraudFallbackData: AntifraudAnalysis = {
  title: 'Анализ звонка',
  eyebrow: 'Антифрод · разблокировка операции',
  callDuration: '01:00',
  state: 'completed',
  context: [
    {
      label: 'Вердикт модели',
      value: 'Дополнительная проверка',
      description: 'итог по тексту первых 60 секунд',
      tone: 'warning',
    },
    {
      label: 'Длительность звонка',
      value: '01:00',
      description: 'в анализ попали первые 60 секунд',
    },
    {
      label: 'Оператор',
      value: 'Ирина М.',
      description: 'линия разблокировки операций',
    },
    {
      label: 'Сценарий',
      value: 'Резервный счёт',
      description: 'цель перевода названа клиентом',
      tone: 'warning',
    },
  ],
  decision: {
    result: {
      state: 'completed',
      outcome: 'verification',
      score: 54,
    },
    summary:
      'Модель подтвердила упоминание резервного счёта и давление срочностью. Для кейса рекомендован один дополнительный проверочный вопрос.',
  },
  confidence: {
    label: 'Индекс воздействия за первые 60 секунд',
    description:
      'Индекс растёт только от подтверждённых текстом сигналов. Голосовые и фоновые признаки в этом анализе не используются.',
    xAxisLabels: ['0 с', '6 с', '12 с', '18 с', '24 с', '30 с', '36 с', '42 с', '48 с', '54 с', '60 с'],
    series: [
      {
        key: 'risk',
        label: 'Индекс воздействия',
        color: '#e66143',
        values: [0, 0, 18, 54, 54, 54, 54, 54, 54, 54, 54],
      },
    ],
    annotations: [
      { label: 'срочность', value: 18 },
      { label: 'резервный счёт', value: 54 },
    ],
  },
  guidance: {
    kind: 'question',
    text: 'Подтвердите, что перевод действительно предназначен для резервного счёта и не является попыткой ускорить операцию.',
    purpose: 'Проверка обоснованности заявления клиента о цели перевода в условиях выраженной срочности.',
    observe: [],
    evidenceIds: ['evidence-1', 'evidence-2'],
  },
  transcript: [
    {
      id: 'operator-greeting',
      speaker: 'Оператор',
      role: 'operator',
      timestamp: '00:03',
      text: 'Добрый день. Вижу, операция приостановлена системой безопасности. Расскажите, пожалуйста, что вы хотели сделать?',
    },
    {
      id: 'client-reason',
      speaker: 'Клиент',
      role: 'client',
      timestamp: '00:09',
      text: 'Мне нужно снять блокировку, срочно. Мне уже объяснили в вашей службе безопасности, что надо перевести.',
      highlights: [
        {
          evidenceId: 'evidence-2',
          startOffset: 28,
          endOffset: 34,
        },
      ],
    },
    {
      id: 'client-account',
      speaker: 'Клиент',
      role: 'client',
      timestamp: '00:14',
      text: 'Мне нужно перевести на резервный счёт, чтобы деньги задекларировать. Ну, чтобы их не списали.',
      highlights: [
        {
          evidenceId: 'evidence-1',
          startOffset: 0,
          endOffset: 68,
        },
      ],
    },
    {
      id: 'client-repeat',
      speaker: 'Клиент',
      role: 'client',
      timestamp: '00:22',
      text: 'Это мои личные средства. Это мои личные средства, да.',
    },
    {
      id: 'operator-rephrase',
      speaker: 'Оператор',
      role: 'operator',
      timestamp: '00:35',
      text: 'Скажите своими словами, зачем вам сегодня этот перевод?',
    },
    {
      id: 'client-repeat-reason',
      speaker: 'Клиент',
      role: 'client',
      timestamp: '00:37',
      text: 'Ну, чтобы задекларировать на резервном счёте. Как мне сказали.',
    },
  ],
  evidence: [
    {
      id: 'evidence-1',
      title: 'Упоминание безопасного или резервного счёта',
      description: 'Клиент упоминает перевод средств на резервный счёт для целей декларирования.',
      quote: '«Мне нужно перевести на резервный счёт, чтобы деньги задекларировать»',
      timestamp: '00:15',
      confidence: 0.9,
      tone: 'warning',
    },
    {
      id: 'evidence-2',
      title: 'Давление срочностью',
      description: 'Клиент использует слово «срочно», указывая на высокую срочность операции.',
      quote: '«срочно»',
      timestamp: '00:09',
      confidence: 1,
      tone: 'warning',
    },
  ],
}
