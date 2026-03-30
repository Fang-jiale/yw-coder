export type ContentSegmentType = 'text' | 'think' | 'todo' | 'question';

export interface BaseSegment {
  type: ContentSegmentType;
  content: string;
}

export interface TextSegment extends BaseSegment {
  type: 'text';
}

export interface ThinkSegment extends BaseSegment {
  type: 'think';
}

export interface TodoItem {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

export interface TodoSegment extends BaseSegment {
  type: 'todo';
  items: TodoItem[];
}

export interface QuestionOption {
  id: string;
  label: string;
  value: string;
}

export interface QuestionSegment extends BaseSegment {
  type: 'question';
  questionId: string;
  question: string;
  options: QuestionOption[];
}

export type ContentSegment = TextSegment | ThinkSegment | TodoSegment | QuestionSegment;

export function parseContentTags(text: string): ContentSegment[] {
  if (!text) return [{ type: 'text', content: '' }];

  const segments: ContentSegment[] = [];
  let remaining = text;

  const tagPatterns = [
    { type: 'think' as const, pattern: /<think[^>]*>([\s\S]*?)<\/think>/gi },
    { type: 'todo' as const, pattern: /<todo[^>]*>([\s\S]*?)<\/todo>/gi },
    { type: 'question' as const, pattern: /<question[^>]*>([\s\S]*?)<\/question>/gi },
  ];

  let lastIndex = 0;
  const allMatches: Array<{ index: number; length: number; segment: ContentSegment }> = [];

  for (const { type, pattern } of tagPatterns) {
    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(text)) !== null) {
      const fullMatch = match[0];
      const content = match[1];
      const matchIndex = match.index;

      if (type === 'think') {
        allMatches.push({
          index: matchIndex,
          length: fullMatch.length,
          segment: { type: 'think', content: content.trim() } as ThinkSegment,
        });
      } else if (type === 'todo') {
        const items = parseTodoItems(content);
        allMatches.push({
          index: matchIndex,
          length: fullMatch.length,
          segment: { type: 'todo', content: content.trim(), items } as TodoSegment,
        });
      } else if (type === 'question') {
        const { question, options } = parseQuestionContent(content);
        const questionId = extractQuestionId(fullMatch);
        allMatches.push({
          index: matchIndex,
          length: fullMatch.length,
          segment: {
            type: 'question',
            content: content.trim(),
            questionId,
            question,
            options,
          } as QuestionSegment,
        });
      }
    }
  }

  allMatches.sort((a, b) => a.index - b.index);

  for (const match of allMatches) {
    if (match.index > lastIndex) {
      const textContent = text.slice(lastIndex, match.index).trim();
      if (textContent) {
        segments.push({ type: 'text', content: textContent });
      }
    }
    segments.push(match.segment);
    lastIndex = match.index + match.length;
  }

  if (lastIndex < text.length) {
    const textContent = text.slice(lastIndex).trim();
    if (textContent) {
      segments.push({ type: 'text', content: textContent });
    }
  }

  if (segments.length === 0) {
    segments.push({ type: 'text', content: text });
  }

  return segments;
}

function parseTodoItems(content: string): TodoItem[] {
  const items: TodoItem[] = [];
  const itemPattern = /<item[^>]*(?:id="([^"]*)")?[^>]*>([\s\S]*?)<\/item>/gi;
  
  let match;
  let index = 0;
  while ((match = itemPattern.exec(content)) !== null) {
    const id = match[1] || `todo-${index}`;
    const itemContent = match[2].trim();
    
    let status: TodoItem['status'] = 'pending';
    if (itemContent.includes('[x]') || itemContent.includes('[X]')) {
      status = 'completed';
    } else if (itemContent.includes('[!]')) {
      status = 'failed';
    } else if (itemContent.includes('[>]') || itemContent.includes('[~]')) {
      status = 'in_progress';
    }

    items.push({
      id,
      content: itemContent.replace(/\[[xX!\->~]\]\s*/g, '').trim(),
      status,
    });
    index++;
  }

  if (items.length === 0) {
    const lines = content.split('\n').filter(line => line.trim());
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('- ') || line.startsWith('* ') || /^\d+\./.test(line)) {
        let status: TodoItem['status'] = 'pending';
        let itemContent = line.replace(/^[-*]\s*/, '').replace(/^\d+\.\s*/, '');
        
        if (itemContent.includes('[x]') || itemContent.includes('[X]')) {
          status = 'completed';
        } else if (itemContent.includes('[!]')) {
          status = 'failed';
        } else if (itemContent.includes('[>]') || itemContent.includes('[~]')) {
          status = 'in_progress';
        }
        
        itemContent = itemContent.replace(/\[[xX!\->~]\]\s*/g, '').trim();
        
        if (itemContent) {
          items.push({
            id: `todo-${i}`,
            content: itemContent,
            status,
          });
        }
      }
    }
  }

  return items;
}

function parseQuestionContent(content: string): { question: string; options: QuestionOption[] } {
  const options: QuestionOption[] = [];
  
  const optionPattern = /<option[^>]*(?:id="([^"]*)")?[^>]*(?:value="([^"]*)")?[^>]*>([\s\S]*?)<\/option>/gi;
  
  let match;
  let index = 0;
  while ((match = optionPattern.exec(content)) !== null) {
    const id = match[1] || `option-${index}`;
    const value = match[2] || match[3].trim();
    const label = match[3].trim();
    
    options.push({ id, label, value });
    index++;
  }

  if (options.length === 0) {
    const lines = content.split('\n').filter(line => line.trim());
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('- ') || line.startsWith('* ') || /^\d+\./.test(line)) {
        const optionText = line.replace(/^[-*]\s*/, '').replace(/^\d+\.\s*/, '').trim();
        if (optionText && !line.includes(':')) {
          options.push({
            id: `option-${i}`,
            label: optionText,
            value: optionText,
          });
        }
      }
    }
  }

  let question = content.replace(optionPattern, '').trim();
  
  const questionMatch = question.match(/^(.+?)(?=\n\s*[-*]|\n\s*\d+\.|$)/s);
  if (questionMatch) {
    question = questionMatch[1].trim();
  }

  return { question, options };
}

function extractQuestionId(fullMatch: string): string {
  const idMatch = fullMatch.match(/id="([^"]*)"/);
  return idMatch ? idMatch[1] : `question-${Date.now()}`;
}
