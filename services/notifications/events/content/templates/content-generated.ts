// @ts-ignore
import { markdown } from 'markdown'

function getSubject(content: any) {
  return "BookBoost - Your Book's Auto-Generated Content - " + content.content_type
}

function getHtmlBody(content: any) {
  return markdown.toHTML(content.text_content)
}

function getTextBody(content: any) {
  return markdown.toHTML(content.text_content)
}

export default {
  getSubject,
  getHtmlBody,
  getTextBody
}
