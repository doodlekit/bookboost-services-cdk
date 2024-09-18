function extractChapters(manuscript) {
  const chapterTitles = [
    'Chapter 1: The Work of a Sales Boss',
    'Chapter 2: The Importance of Sacred Rhythms',
    'Chapter 3: The DNA of a Sales Boss',
    'Chapter 4: The Truth About Humans',
    'Chapter 5: Your First 30 Days as Boss',
    'Chapter 6: Understanding the Market for Hiring',
    'Chapter 7: Step-By-Step to Hiring a Sales Superstar',
    'Chapter 8 : Use the Power of Science in Selection',
    'Chapter 9: Onboarding a New Member of the Sales Team',
    'Chapter 10: Know Your Sales Process and Your Numbers',
    'Chapter 11: Who Gets My Time and Attention?',
    'Chapter 12: Team Rhythms that Lead to Group Cohesion',
    'Chapter 13: Individual Rhythms That Lead to Star Performances',
    'Chapter 14: Keep Score Publically',
    'Chapter 15: Lead by Principle, Not Policy',
    'Chapter 16: Make Sales Technology Work For You',
    'Chapter 17: Money Talks: Compensation Planning',
    'Chapter 18: Forecasting the Future',
    'Chapter 19: Replicating Success',
    'Chapter 20: The Business of You'
  ]

  const chapters = []
  let currentChapter = null
  let currentContent = ''

  const lines = manuscript.split('\n')

  for (let line of lines) {
    line = line.trim()
    let isChapterTitle = false

    for (let title of chapterTitles) {
      if (line.toLowerCase().includes(title.toLowerCase())) {
        isChapterTitle = true
        if (currentChapter) {
          chapters.push({
            title: currentChapter,
            content: currentContent.trim()
          })
        }
        currentChapter = line
        currentContent = ''
        break
      }
    }

    if (!isChapterTitle && currentChapter) {
      currentContent += line + '\n'
    }
  }

  if (currentChapter) {
    chapters.push({
      title: currentChapter,
      content: currentContent.trim()
    })
  }

  return chapters
}
