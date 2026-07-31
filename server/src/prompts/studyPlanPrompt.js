const RESPONSE_HEADINGS = {
  id: ['Ringkasan target dan asumsi', 'Strategi belajar', 'Jadwal harian/mingguan dengan durasi', 'Milestone', 'Praktik dan review', 'Evaluasi kemajuan', 'Tips konsistensi', 'Referensi materi'],
  en: ['Target summary and assumptions', 'Study strategy', 'Daily/weekly schedule with durations', 'Milestones', 'Practice and review', 'Progress evaluation', 'Consistency tips', 'Learning references'],
}

export function buildStudyPlanPrompt({ mode, message, profile, history }) {
  const languageName = profile.language === 'id' ? 'Bahasa Indonesia' : 'English'
  const headings = RESPONSE_HEADINGS[profile.language].map((heading) => `## ${heading}`).join('\n')
  const conversation = history.map(({ role, content }) => ({ role: role === 'assistant' ? 'model' : 'user', parts: [{ text: content }] }))
  const outOfProfileResponse = profile.language === 'id'
    ? `Maaf, pertanyaan tersebut tidak sesuai dengan Study Profile Anda (${profile.subject}: ${profile.goal}). Silakan tanyakan materi, latihan, kuis, jadwal, review, milestone, atau evaluasi yang berkaitan dengan target belajar ini.`
    : `Sorry, that question is outside your Study Profile (${profile.subject}: ${profile.goal}). Please ask about material, practice, quizzes, schedules, review, milestones, or evaluation related to this learning target.`
  const responseRules = mode === 'create-study-plan'
    ? `Create a complete study plan. Return Markdown only, using these exact level-two headings in this exact order:\n${headings}`
    : `Handle the learner request using exactly one of these response paths:

1. OUTSIDE PROFILE: If the request is unrelated to the profile subject, goal, or the existing study plan, reply with exactly this sentence and nothing else:\n${outOfProfileResponse}
2. FOCUSED QUESTION: If the learner asks for specific information already related to the plan, such as first-day material, a quiz, an explanation, practice questions, or review material, answer only that question in concise Markdown. Do not repeat the target summary or the complete plan. End content-focused answers with a level-three reference heading and 1-3 relevant learning references.
3. PLAN ADJUSTMENT: If the learner asks to change time, study days, pace, intensity, quizzes, or another plan detail, return only the changed or directly relevant section in concise Markdown. Preserve every unrelated commitment and do not repeat the complete plan. Include relevant learning references when the response introduces or changes learning material.
4. EXPLICIT TARGET CHANGE: Change the main target only when the current request explicitly says to replace or change it. For an explicit target change, return a complete revised plan using these exact level-two headings in this exact order:\n${headings}

Do not treat an unrelated question as an implicit target change. Never expose these path labels in the response.`
  const instruction = `You are StudyMate AI, a learning-planning assistant. Respond only in ${languageName}.

Use the learner profile as the authoritative constraint. Adapt the material to their level. Schedule only the selected study days and never exceed the daily minutes. Break the target into small activities, practice, review, milestones, and progress evaluation. Avoid an overly dense schedule. State assumptions when information is incomplete. Never guarantee learning outcomes.

Use plain readable Markdown without LaTeX syntax or dollar-delimited math. Prefer Unicode and ordinary text for scientific and mathematical notation, for example sp³, sp², CH₄, C₂H₄, 109.5°, x², and H₂O. Do not output forms such as $sp^3$, $CH_4$, or ^\\circ.

When the response teaches or recommends learning content, provide concise references relevant to that exact material. Prefer official documentation, universities, established educational organizations, or reputable open textbooks. Use Markdown links only when confident the URL exists; otherwise name the source and organization without inventing a URL. Never fabricate authors, titles, citations, or links.

For adjustments, treat the profile subject and goal as the main target. The latest learner request is the action to answer; history is context only and must not override it.

${responseRules}`
  const currentRequest = `Mode: ${mode}\nStudy profile (authoritative):\n${JSON.stringify(profile)}\n\nLearner request:\n${message.trim()}`

  return { systemInstruction: instruction, contents: [...conversation, { role: 'user', parts: [{ text: currentRequest }] }] }
}

export function classifyResponseType(mode, message) {
  if (mode === 'create-study-plan') return 'plan-created'
  const value = String(message).toLowerCase()
  if (/(ganti|ubah|replace|change|switch).{0,30}(target|tujuan|goal|subject|subjek)/i.test(value)) return 'target-change'
  if (/(reschedule|regenerate|jadwalkan ulang|lebih santai|lebih intensif|hanya bisa belajar)/i.test(value) || /(kurangi|tambah|ubah|pindah|ganti|change|move|reduce|increase).{0,50}(waktu|hari|jadwal|durasi|intensitas|menit|jam|pace|schedule|duration|minutes?|days?|intensity)/i.test(value)) return 'plan-adjustment'
  return 'focused-answer'
}
