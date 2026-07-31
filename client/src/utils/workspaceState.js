export function hasLearningActivity(sessions, progress) {
  return sessions.some((session) => {
    const item = progress[session.id]
    return Boolean(item?.materialCompleted || item?.practiceCompleted || item?.quiz || item?.attempts?.length)
  })
}

export const resolveWorkspaceMode = (requestedMode, started) => requestedMode ?? (started ? 'session' : 'overview')
