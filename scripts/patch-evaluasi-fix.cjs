const fs = require('fs');

const files = ['src/assessmentModule.js', 'public/assessmentModule.js'];

const replacements = [
  {
    label: 'evaluation question sync field',
    from: "            if (monRes.studentQuestions) appState.studentExamQuestions = { ...(appState.studentExamQuestions || {}), ...monRes.studentQuestions };",
    to: "            const serverStudentQuestions = monRes.studentExamQuestions || monRes.studentQuestions;\n            if (serverStudentQuestions) appState.studentExamQuestions = { ...(appState.studentExamQuestions || {}), ...serverStudentQuestions };"
  },
  {
    label: 'authoritative completed answer count',
    from: `                                                const totalAnsweredCount = (currentSession && currentSession.answeredCount !== undefined && currentSession.answeredCount > 0)\n                                                    ? currentSession.answeredCount\n                                                    : (answeredPGCount + answeredEssayCount);\n\n                                                const totalQuestionsCount = (currentSession && currentSession.totalQuestions)\n                                                    ? currentSession.totalQuestions\n                                                    : stQuestions.length;`,
    to: `                                                // Completed attempts must show progress from authoritative stored answers,\n                                                // not only from a possibly stale local question package.\n                                                const storedAnsweredCount = studentAnswers\n                                                    ? Object.values(studentAnswers).filter(value => value !== undefined && value !== null && String(value).trim() !== '').length\n                                                    : 0;\n                                                const gradeTotalQuestions = gradeObj\n                                                    ? (Number(gradeObj.totalPGCount || 0) + Number(gradeObj.totalEssayCount || 0))\n                                                    : 0;\n\n                                                const totalAnsweredCount = (isCompleted && storedAnsweredCount > 0)\n                                                    ? storedAnsweredCount\n                                                    : ((currentSession && currentSession.answeredCount !== undefined && currentSession.answeredCount > 0)\n                                                        ? currentSession.answeredCount\n                                                        : Math.max(storedAnsweredCount, answeredPGCount + answeredEssayCount));\n\n                                                const totalQuestionsCount = (currentSession && currentSession.totalQuestions)\n                                                    ? currentSession.totalQuestions\n                                                    : (stQuestions.length || gradeTotalQuestions || storedAnsweredCount);`
  },
  {
    label: 'completed status progress text',
    from: "                                                            <span class=\"text-[9px] text-emerald-600/80 font-medium mt-0.5\">Ujian Ditutup</span>",
    to: "                                                            <span class=\"text-[9px] text-emerald-600/80 font-medium mt-0.5\">${totalAnsweredCount}/${totalQuestionsCount} Soal Terjawab</span>"
  },
  {
    label: 'PG denominator from authoritative grade',
    from: "                                                            <span class=\"text-[9px] text-slate-400 mt-0.5\">${gradeObj?.correctPGCount !== undefined ? gradeObj.correctPGCount : correctPGCount}/${pgQuestions.length} Benar</span>",
    to: "                                                            <span class=\"text-[9px] text-slate-400 mt-0.5\">${gradeObj?.correctPGCount !== undefined ? gradeObj.correctPGCount : correctPGCount}/${gradeObj?.totalPGCount !== undefined ? gradeObj.totalPGCount : pgQuestions.length} Benar</span>"
  }
];

for (const file of files) {
  let text = fs.readFileSync(file, 'utf8');
  for (const { label, from, to } of replacements) {
    if (!text.includes(from)) {
      throw new Error(`${file}: target not found for ${label}`);
    }
    text = text.replace(from, to);
  }
  fs.writeFileSync(file, text, 'utf8');
  console.log(`patched ${file}`);
}
