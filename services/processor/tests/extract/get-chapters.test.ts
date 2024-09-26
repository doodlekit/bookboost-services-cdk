import dotenv from 'dotenv'
dotenv.config()

import { getChapterTitles } from '../../extract'
import fs from 'fs'
import path from 'path'
import { expect, jest, test } from '@jest/globals'

function downcaseAllTitles(titles: string[]) {
  return titles.map((title) => title.toLowerCase())
}

describe('getChapterTitles', () => {
  jest.retryTimes(2)
  const booksFolder = path.join(__dirname, 'fixtures', 'books')
  const outputFolder = path.join(__dirname, 'output')

  beforeAll(async () => {
    // Ensure the output folder exists
    fs.mkdirSync(outputFolder, { recursive: true })
  })

  it('should extract chapter titles from books and write to JSON files', async () => {
    let bookFiles = fs.readdirSync(booksFolder)
    bookFiles = bookFiles.filter((file) => !file.includes('party') && !file.includes('wtf'))

    for (const bookFile of bookFiles) {
      if (path.extname(bookFile) === '.txt') {
        const bookPath = path.join(booksFolder, bookFile)
        const fileContent = fs.readFileSync(bookPath, 'utf-8')
        // Get PDF

        let chapterTitles, prompt
        console.log('using fileContent')
        const titles = await getChapterTitles(fileContent)
        chapterTitles = titles.chapterTitles
        prompt = titles.prompt

        const outputFileName = `${path.basename(bookFile, '.txt')}_chapters.json`
        const outputPath = path.join(outputFolder, outputFileName)

        fs.writeFileSync(outputPath, JSON.stringify(chapterTitles, null, 2), 'utf-8')

        const outputPromptPath = path.join(
          outputFolder,
          `${path.basename(bookFile, '.txt')}_prompt.txt`
        )
        fs.writeFileSync(outputPromptPath, prompt, 'utf-8')

        // Basic assertions
        expect(Array.isArray(chapterTitles)).toBe(true)
        expect(chapterTitles.length).toBeGreaterThan(0)
        chapterTitles.forEach((title: string) => {
          expect(typeof title).toBe('string')
          expect(title.trim()).not.toBe('')
        })

        const chaptersFixturePath = path.join(__dirname, 'fixtures', 'titles', outputFileName)
        const chaptersFixture = JSON.parse(fs.readFileSync(chaptersFixturePath, 'utf-8'))

        expect(downcaseAllTitles(chapterTitles).sort()).toEqual(
          downcaseAllTitles(chaptersFixture).sort()
        )

        console.log(`Processed ${bookFile} and wrote results to ${outputFileName}`)
      }
    }
  }, 240000) // Increase timeout to 120 seconds
})
