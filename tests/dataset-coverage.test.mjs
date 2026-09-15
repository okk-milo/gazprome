import assert from 'node:assert/strict'
import test from 'node:test'
import { parseDatasetResponse, scenarioWeeks } from '../src/services/burnout-dataset.ts'

test('dataset status distinguishes empty from invalid or inconsistent responses', () => {
  assert.deepEqual(parseDatasetResponse({state:'empty'}), {state:'empty'})
  const dataset = {id:'6dca1f5e-16b9-49c2-b164-cadf2e73a615',periodStart:'2026-07-27',provenance:'authored_scenario',coverage:{accepted:2,pending:3,excluded:1,total:6},weeklyScores:Array.from({length:8},()=>({exhaustion:0,distance:20,speechInconsistency:30,workload:100})),weeklyCoverage:Array.from({length:8},(_,index)=>({index,accepted:index===0?2:0,pending:index===0?3:0,excluded:index===0?1:0,audioSeconds:0}))}
  dataset.observations = []
  assert.equal(parseDatasetResponse({state:'ready',dataset}).dataset.coverage.accepted, 2)
  assert.throws(() => parseDatasetResponse({state:'ready',dataset:{...dataset,coverage:{...dataset.coverage,total:187}}}))
  assert.throws(() => parseDatasetResponse({state:'ready',dataset:{...dataset,provenance:'diagnosis'}}))
  assert.throws(() => parseDatasetResponse({state:'failed'}))
  assert.throws(() => parseDatasetResponse({state:'ready',dataset:{...dataset,periodStart:'2026-02-30'}}))
  assert.throws(() => parseDatasetResponse({state:'ready',dataset:{...dataset,weeklyScores:[]}}))
  assert.throws(() => parseDatasetResponse({state:'ready',dataset:{...dataset,weeklyCoverage:dataset.weeklyCoverage.toReversed()}}))
  assert.equal(parseDatasetResponse({state:'ready',dataset}).dataset.weeklyScores[0].workload,100)
})

test('scenario dates cross months and years in UTC without changing the week count', () => {
  const weeks = scenarioWeeks('2026-12-28')
  assert.equal(weeks.length, 8)
  assert.equal(weeks[0].dates, '28.12–03.01')
  assert.equal(weeks[7].label, 'Неделя 8')
  assert.throws(() => scenarioWeeks('2026-02-30'))
})
