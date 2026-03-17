/**
 * Code Rewrite Service - 代码重写/重构服务
 * 支持选中代码后进行 AI 辅助重写
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { AIProviderConfig } from '../../shared/types';
import AIService from '../services/aiService';

export interface RewriteRequest {
  code: string;
  language: string;
  filePath: string;
  instruction: string;
  mode: 'rewrite' | 'refactor' | 'optimize' | 'explain' | 'fix';
}

export interface RewriteResult {
  originalCode: string;
  modifiedCode: string;
  explanation: string;
  changes: CodeChange[];
}

export interface CodeChange {
  type: 'added' | 'removed' | 'modified';
  startLine: number;
  endLine: number;
  content: string;
}

export interface RefactorOption {
  id: string;
  name: string;
  description: string;
  preview: string;
}

/**
 * 代码重写服务
 */
export class CodeRewriteService {
  private aiService: AIService;

  constructor(aiService: AIService) {
    this.aiService = aiService;
  }

  /**
   * 重写代码
   */
  async rewrite(request: RewriteRequest, config: AIProviderConfig): Promise<RewriteResult> {
    const { code, language, instruction, mode } = request;

    const systemPrompt = this.getSystemPrompt(mode);
    const userPrompt = this.buildPrompt(code, language, instruction, mode);

    try {
      const response = await this.aiService.chat(
        {
          messages: [
            { id: '1', role: 'system', content: systemPrompt, timestamp: Date.now() },
            { id: '2', role: 'user', content: userPrompt, timestamp: Date.now() },
          ],
          model: config.model,
        },
        config.id
      );

      return this.parseResponse(code, response.content);
    } catch (error) {
      throw new Error(`Code rewrite failed: ${error}`);
    }
  }

  /**
   * 获取重构选项
   */
  async getRefactorOptions(
    code: string,
    language: string,
    config: AIProviderConfig
  ): Promise<RefactorOption[]> {
    const prompt = `分析以下代码并提供 3-5 个重构选项。

语言: ${language}
代码:
\`\`\`
${code}
\`\`\`

请以 JSON 格式返回重构选项：
[
  {
    "id": "option-1",
    "name": "选项名称",
    "description": "选项描述",
    "preview": "代码预览"
  }
]`;

    try {
      const response = await this.aiService.chat(
        {
          messages: [
            { id: '1', role: 'system', content: '你是一个代码重构专家。请提供专业的重构建议。', timestamp: Date.now() },
            { id: '2', role: 'user', content: prompt, timestamp: Date.now() },
          ],
          model: config.model,
        },
        config.id
      );

      return this.parseRefactorOptions(response.content);
    } catch (error) {
      throw new Error(`Failed to get refactor options: ${error}`);
    }
  }

  /**
   * 修复代码错误
   */
  async fixError(
    code: string,
    language: string,
    errorMessage: string,
    config: AIProviderConfig
  ): Promise<RewriteResult> {
    return this.rewrite(
      {
        code,
        language,
        filePath: '',
        instruction: `修复以下错误: ${errorMessage}`,
        mode: 'fix',
      },
      config
    );
  }

  /**
   * 解释代码
   */
  async explainCode(
    code: string,
    language: string,
    config: AIProviderConfig
  ): Promise<string> {
    const prompt = `请解释以下代码的功能和工作原理：

语言: ${language}
代码:
\`\`\`
${code}
\`\`\``;

    try {
      const response = await this.aiService.chat(
        {
          messages: [
            { id: '1', role: 'system', content: '你是一个代码解释专家。请详细解释代码的功能。', timestamp: Date.now() },
            { id: '2', role: 'user', content: prompt, timestamp: Date.now() },
          ],
          model: config.model,
        },
        config.id
      );

      return response.content;
    } catch (error) {
      throw new Error(`Failed to explain code: ${error}`);
    }
  }

  /**
   * 获取系统提示词
   */
  private getSystemPrompt(mode: string): string {
    switch (mode) {
      case 'rewrite':
        return `你是一个代码重写专家。请根据用户的指示重写代码，只返回重写后的代码和简要说明。`;
      case 'refactor':
        return `你是一个代码重构专家。请提供高质量的重构方案，改善代码结构和可读性。`;
      case 'optimize':
        return `你是一个性能优化专家。请优化代码以提高性能和效率。`;
      case 'fix':
        return `你是一个 bug 修复专家。请修复代码中的错误，只返回修复后的代码。`;
      case 'explain':
      default:
        return `你是一个代码解释专家。请详细解释代码的功能和工作原理。`;
    }
  }

  /**
   * 构建提示词
   */
  private buildPrompt(code: string, language: string, instruction: string, mode: string): string {
    if (mode === 'explain') {
      return `请解释以下 ${language} 代码：
\`\`\`${language}
${code}
\`\`\``;
    }

    return `请重写以下 ${language} 代码：

用户指示: ${instruction}

原始代码:
\`\`\`${language}
${code}
\`\`\`

请返回 JSON 格式：
{
  "modifiedCode": "重写后的代码",
  "explanation": "修改说明",
  "changes": [
    { "type": "added|removed|modified", "startLine": 1, "endLine": 10, "content": "变更内容" }
  ]
}`;
  }

  /**
   * 解析响应
   */
  private parseResponse(originalCode: string, response: string): RewriteResult {
    try {
      // 尝试解析 JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          originalCode,
          modifiedCode: parsed.modifiedCode || response,
          explanation: parsed.explanation || '',
          changes: parsed.changes || [],
        };
      }
    } catch (e) {
      // JSON 解析失败，返回原始响应作为修改后的代码
    }

    return {
      originalCode,
      modifiedCode: response,
      explanation: '',
      changes: [],
    };
  }

  /**
   * 解析重构选项
   */
  private parseRefactorOptions(response: string): RefactorOption[] {
    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      // 解析失败
    }
    return [];
  }
}

export default CodeRewriteService;
