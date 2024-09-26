import path from 'path'
import fs from 'fs'
import dotenv from 'dotenv'
dotenv.config()
import { evaluateExtraction, processManuscript } from '../../extract'

interface Chapter {
  title: string
  content: string
}

interface RunResult {
  bookName: string
  runNumber: number
  chapters: Chapter[]
  evaluation?: Evaluation
}

interface Evaluation {
  score: number
  summary: string
}

interface BookIndex {
  [bookName: string]: {
    runs: RunResult[]
  }
}

async function run() {
  const booksDir = path.join(__dirname, 'fixtures', 'books')
  const outputDir = path.join(__dirname, 'training_data')
  const bookFiles = fs.readdirSync(booksDir).filter((file) => file.endsWith('.txt'))
  const indexPath = path.join(outputDir, 'index.json')

  // Delete everything in the output directory
  fs.rmSync(outputDir, { recursive: true, force: true })

  // Initialize or load existing index
  let bookIndex: BookIndex = {}
  if (fs.existsSync(indexPath)) {
    bookIndex = JSON.parse(fs.readFileSync(indexPath, 'utf8'))
  }

  for (const bookFile of bookFiles) {
    const bookName = path.basename(bookFile, '.txt')
    const filePath = path.join(booksDir, bookFile)
    const manuscript = fs.readFileSync(filePath, 'utf8')
    const pdfPath = path.join(booksDir, 'pdf', `${path.basename(bookFile, '.txt')}.pdf`)

    if (!bookIndex[bookName]) {
      bookIndex[bookName] = { runs: [] }
    }

    for (let i = 0; i < 1; i++) {
      await new Promise((resolve) => setTimeout(resolve, 5000))
      const runDir = path.join(outputDir, bookName, `run_${i + 1}`)
      fs.mkdirSync(runDir, { recursive: true })

      let runResult: RunResult

      try {
        const { chapters, prompt } = await processManuscript(manuscript)
        runResult = {
          bookName,
          runNumber: i + 1,
          chapters
        }
      } catch (error: any) {
        console.error(`Error processing ${bookName} run ${i + 1}:`, error)
        runResult = {
          bookName,
          runNumber: i + 1,
          chapters: [],
          evaluation: {
            score: 0,
            summary: error.message
          }
        }
      }

      try {
        const evaluation = await evaluateExtraction(runResult.chapters, manuscript)
        runResult.evaluation = evaluation
      } catch (error: any) {
        console.error(`Error evaluating ${bookName} run ${i + 1}:`, error)
        runResult.evaluation = {
          score: 0,
          summary: error.message
        }
      }

      bookIndex[bookName].runs.push(runResult)

      // Update index file after each run
      fs.writeFileSync(indexPath, JSON.stringify(bookIndex, null, 2))

      // Save individual run results
      fs.writeFileSync(path.join(runDir, 'result.json'), JSON.stringify(runResult, null, 2))
    }
  }
}

run()
