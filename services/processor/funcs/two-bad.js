function extractChapters(manuscript) {
  const chapterTitles = [
    'The Work of a Sales Boss',
    'The Importance of Sacred Rhythms',
    'The DNA of a Sales Boss',
    'The Truth About Humans',
    'Your First 30 Days as Boss',
    'Understanding the Market for Hiring',
    'Step-By-Step to Hiring a Sales Superstar',
    'Use the Power of Science in Selection',
    'Onboarding a New Member of the Sales Team',
    'Know Your Sales Process and Your Numbers',
    'Who Gets My Time and Attention?',
    'Team Rhythms that Lead to Group Cohesion',
    'Individual Rhythms That Lead to Star Performances',
    'Keep Score Publically',
    'Lead by Principle, Not Policy',
    'Make Sales Technology Work For You',
    'Money Talks: Compensation Planning',
    'Forecasting the Future',
    'Replicating Success',
    'The Business of You'
  ]

  const chapters = []
  const chapterRegex = /Chapter\s+\d+:\s+(.+)|CHAPTER\s+[A-Z]+:\s+(.+)|\d+\.\s+(.+)/i

  const lines = manuscript.split('\n')
  let currentChapter = null
  let chapterContent = ''

  for (const line of lines) {
    const match = line.match(chapterRegex)
    if (match) {
      if (currentChapter) {
        chapters.push({
          title: currentChapter,
          content: chapterContent.trim()
        })
        chapterContent = ''
      }
      currentChapter = match[1] || match[2] || match[3]
      if (chapterTitles.some((title) => currentChapter.includes(title))) {
        continue
      }
    }
    if (currentChapter) {
      chapterContent += line + '\n'
    }
  }

  if (currentChapter) {
    chapters.push({
      title: currentChapter,
      content: chapterContent.trim()
    })
  }

  return chapters
}
