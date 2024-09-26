import dotenv from 'dotenv'
dotenv.config()

import fs from 'fs'
import path from 'path'
import { postProcessChapter } from '../../extract'

function downcaseAllTitles(titles: string[]) {
  return titles.map((title) => title.toLowerCase())
}

describe('postProcessChapter', () => {
  const booksFolder = path.join(__dirname, '..', '..', 'trainer', 'books')
  const outputFolder = path.join(__dirname, 'output')
  const fixtureFolder = path.join(__dirname, 'fixtures', 'chapters')

  beforeAll(async () => {
    // Ensure the output folder exists
    fs.mkdirSync(outputFolder, { recursive: true })
  })

  it('should post process chapter', async () => {
    const chapter = fs.readFileSync(path.join(fixtureFolder, 'long-chapter.txt'), 'utf-8')
    const fileSize = fs.statSync(path.join(fixtureFolder, 'long-chapter.txt')).size
    const processedChapter = await postProcessChapter({
      title: 'Long Chapter',
      content: chapter
    })
    console.log('Processed Chapter:', processedChapter)
    const contents = processedChapter.content
    console.log('Processed Chapter:', processedChapter.content)
    console.log('File Size:', fileSize)
    console.log('Contents Size:', contents.length)
  }, 240000)
})
