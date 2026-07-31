import assert from 'node:assert/strict'
import test from 'node:test'
import { getWorkspaceLabels } from '../src/utils/workspaceLabels.js'
import { hasLearningActivity, resolveWorkspaceMode } from '../src/utils/workspaceState.js'

const sessions = [{ id: 's1' }, { id: 's2' }]
const emptyProgress = { s1: { materialCompleted: false, practiceCompleted: false, quiz: null, attempts: [] }, s2: { materialCompleted: false, practiceCompleted: false, quiz: null, attempts: [] } }

test('workspace starts in overview and switches after the first learning activity', () => {
  assert.equal(hasLearningActivity(sessions, emptyProgress), false)
  assert.equal(resolveWorkspaceMode(null, false), 'overview')
  const started = { ...emptyProgress, s1: { ...emptyProgress.s1, materialCompleted: true } }
  assert.equal(hasLearningActivity(sessions, started), true)
  assert.equal(resolveWorkspaceMode(null, true), 'session')
})

test('opening a quiz counts as learning activity and explicit navigation can show overview', () => {
  const started = { ...emptyProgress, s2: { ...emptyProgress.s2, quiz: { id: 'q2' } } }
  assert.equal(hasLearningActivity(sessions, started), true)
  assert.equal(resolveWorkspaceMode('overview', true), 'overview')
  assert.equal(resolveWorkspaceMode('session', false), 'session')
})

test('workspace labels consistently follow the selected plan language', () => {
  const indonesian = getWorkspaceLabels('id')
  assert.equal(indonesian.activePlan, 'Rencana belajar aktif')
  assert.equal(indonesian.statuses['needs-review'], 'Perlu dipelajari lagi')
  assert.equal(indonesian.days.wednesday, 'Rab')
  assert.equal(indonesian.quizLoadError, 'Kuis tidak dapat dimuat. Silakan coba lagi.')
  const english = getWorkspaceLabels('en')
  assert.equal(english.activePlan, 'Active study plan')
  assert.equal(english.statuses.completed, 'Completed')
  assert.equal(english.days.wednesday, 'Wed')
})
