export function buildSessionsPrompt({ profile, planMarkdown, previousSessions, adjustment }) {
  const language = profile.language === 'id' ? 'Bahasa Indonesia' : 'English'
  return `Return JSON only. Convert the study plan into ordered learning sessions in ${language}.
Each session must use only these study days: ${profile.studyDays.join(', ')} and durationMinutes must not exceed ${profile.dailyMinutes}.
Each session needs title, objective, studyDay, durationMinutes, milestone, and exactly two activities: material and practice.
When previous sessions are supplied, put their id in previousId only when the learning objective is materially unchanged; otherwise use null.
When Adjustment represents an explicit target change, derive the new subject and objective from Adjustment.answer and Plan Markdown while preserving the profile's level, duration, daily time, study days, learning style, intensity, and language.
Schema: {"sessions":[{"previousId":string|null,"order":number,"title":string,"objective":string,"studyDay":string,"durationMinutes":number,"milestone":string,"activities":[{"type":"material"|"practice","title":string,"description":string}]}]}.
Profile: ${JSON.stringify(profile)}
Previous sessions: ${JSON.stringify(previousSessions)}
Adjustment: ${JSON.stringify(adjustment ?? null)}
Plan Markdown:\n${planMarkdown}`
}

export function buildQuizPrompt({ profile, session }) {
  const language = profile.language === 'id' ? 'Bahasa Indonesia' : 'English'
  return `Return JSON only. Create exactly five multiple-choice questions in ${language} for this learning session and learner level ${profile.level}.
Each question must have exactly four options, one correctOptionId, and a concise explanation. Include 1-3 relevant learning references. Never invent a URL; omit the URL when uncertain.
Schema: {"questions":[{"prompt":string,"options":[{"id":"a"|"b"|"c"|"d","text":string}],"correctOptionId":"a"|"b"|"c"|"d","explanation":string}],"references":[{"title":string,"url":string|null}]}.
Profile: ${JSON.stringify(profile)}
Session: ${JSON.stringify(session)}`
}
