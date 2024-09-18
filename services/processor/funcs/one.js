function extractChapters(manuscript) {
  const chapterTitles = [
    'Prologue',
    'Chapter 1 - Introduction: Setting the Stage for Success',
    'Chapter 2 - Understanding Your Service Business',
    'Chapter 3 - Building a Strong Brand Identity',
    'Chapter 4 - The Power of Customer Research',
    'Chapter 5 - Crafting Irresistible Service Offers',
    'Chapter 6 - Digital Marketing Essentials',
    'Chapter 7 - Networking and Relationship Marketing',
    'Chapter 8 - Effective Pricing Strategies',
    'Chapter 9 - Measuring and Optimizing Your Marketing Efforts',
    'Chapter 10 - Marketing vs Branding',
    'Chapter 11 - The Psychology of Small Business: Early Beginnings',
    'Chapter 12 - Growth Often Requires a Better Environment',
    'Chapter 13 - Systems: The backbone of Small Business Growth!',
    "Epilogue - It's a game of 1's and 0's"
  ]

  const chapters = []
  let currentChapter = null

  const lines = manuscript.split('\n')

  for (const line of lines) {
    const trimmedLine = line.trim()
    const chapterMatch = chapterTitles.find((title) =>
      trimmedLine.toLowerCase().includes(title.toLowerCase())
    )

    if (chapterMatch) {
      if (currentChapter) {
        chapters.push(currentChapter)
      }
      currentChapter = { title: chapterMatch, content: '' }
    } else if (currentChapter) {
      currentChapter.content += line + '\n'
    }
  }

  if (currentChapter) {
    chapters.push(currentChapter)
  }

  return chapters
}
