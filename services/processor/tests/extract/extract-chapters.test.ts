import dotenv from 'dotenv'
dotenv.config()

import { getChapterTitles, extractChapters } from '../../extract'
import fs from 'fs/promises'
import path from 'path'

describe('extractChapters', () => {
  const booksFolder = path.join(__dirname, 'fixtures', 'books')
  const outputFolder = path.join(__dirname, 'output')

  beforeAll(async () => {
    // Ensure the output folder exists
    await fs.mkdir(outputFolder, { recursive: true })
  })

  it('should extract chapters from books and write to JSON files', async () => {
    let bookFiles = await fs.readdir(booksFolder)
    // bookFiles = bookFiles.filter((file) => file.includes('boss'))

    for (const bookFile of bookFiles) {
      if (path.extname(bookFile) === '.txt') {
        const bookPath = path.join(booksFolder, bookFile)
        const fileContent = await fs.readFile(bookPath, 'utf-8')
        const baseOutputFileName = path.basename(bookFile, '.txt')

        const chaptersFixturePath = path.join(
          __dirname,
          'fixtures',
          'chapters',
          `${baseOutputFileName}_chapters.json`
        )
        const chaptersFixtures = JSON.parse(await fs.readFile(chaptersFixturePath, 'utf-8'))

        const chapters = await extractChapters(fileContent, chaptersFixtures)

        const outputFileName = `${baseOutputFileName}_content.json`
        const outputPath = path.join(outputFolder, outputFileName)

        await fs.writeFile(outputPath, JSON.stringify(chapters, null, 2), 'utf-8')

        const allLowerCaseTitles = chapters.map((chapter) => chapter.title.toLowerCase())
        const allLowerCaseChaptersFixtures = chaptersFixtures.map((chapter: any) =>
          chapter.toLowerCase()
        )
        expect(allLowerCaseTitles).toEqual(allLowerCaseChaptersFixtures)

        console.log(`Processed ${bookFile} and wrote results to ${outputFileName}`)
      }
    }
  }, 120000)
})
