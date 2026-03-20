import * as fs from 'fs/promises';
import * as path from 'path';
import OpenAI from 'openai';
import { AIProviderConfig } from '../../shared/types';

export interface GeneratedFile {
  path: string;
  content: string;
  language: string;
}

export interface BuilderStep {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  type: 'analysis' | 'planning' | 'coding' | 'testing' | 'deployment';
  result?: string;
}

export interface BuilderTask {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  steps: BuilderStep[];
  currentStep: number;
  generatedFiles?: GeneratedFile[];
}

export interface CodeEdit {
  filePath: string;
  searchCode: string;
  replaceCode: string;
  explanation: string;
}

export class BuilderService {
  private openai: OpenAI | null = null;
  private currentTask: BuilderTask | null = null;
  private onProgressCallback: ((task: BuilderTask) => void) | null = null;
  private currentConfig: AIProviderConfig | null = null;

  constructor() {}

  public setConfig(config: AIProviderConfig): void {
    this.currentConfig = config;
    this.initializeClient();
  }

  private initializeClient(): void {
    if (!this.currentConfig) {
      throw new Error('No AI configuration set. Please configure AI settings first.');
    }

    const baseURL = this.currentConfig.baseUrl || this.getDefaultBaseUrl(this.currentConfig.provider);

    this.openai = new OpenAI({
      apiKey: this.currentConfig.apiKey,
      baseURL,
      timeout: 120000, // 2分钟超时
    });
  }

  private getDefaultBaseUrl(provider: string): string {
    const urls: Record<string, string> = {
      openai: 'https://api.openai.com/v1',
      anthropic: 'https://api.anthropic.com',
      google: 'https://generativelanguage.googleapis.com/v1beta',
      deepseek: 'https://api.deepseek.com/v1',
      minimax: 'https://api.minimaxi.com/v1',
      moonshot: 'https://api.moonshot.cn/v1',
      qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      baichuan: 'https://api.baichuan-ai.com/v1',
      ollama: 'http://localhost:11434/v1',
      lmstudio: 'http://localhost:1234/v1',
      openrouter: 'https://openrouter.ai/api/v1',
      siliconflow: 'https://api.siliconflow.cn/v1',
      custom: 'http://localhost:8000/v1',
    };
    return urls[provider] || urls.openai;
  }

  private getClient(): OpenAI {
    if (!this.openai) {
      throw new Error('AI client not initialized. Please configure API key in settings.');
    }
    return this.openai;
  }

  private getModel(): string {
    return this.currentConfig?.model || 'gpt-4';
  }

  public onProgress(callback: (task: BuilderTask) => void): void {
    this.onProgressCallback = callback;
  }

  private updateProgress(task: BuilderTask): void {
    this.currentTask = task;
    if (this.onProgressCallback) {
      this.onProgressCallback(task);
    }
  }

  // 生成新项目
  public async generateProject(description: string, workspacePath: string, config: AIProviderConfig): Promise<BuilderTask> {
    this.setConfig(config);
    
    const task: BuilderTask = {
      id: this.generateId(),
      description,
      status: 'in_progress',
      currentStep: 0,
      steps: [
        {
          id: this.generateId(),
          description: '分析需求并规划项目结构',
          status: 'in_progress',
          type: 'analysis',
        },
      ],
    };

    this.updateProgress(task);

    try {
      // Step 1: Analyze requirements
      const plan = await this.analyzeRequirements(description);
      task.steps[0].status = 'completed';
      task.steps[0].result = plan;

      // Step 2: Generate files
      task.steps.push({
        id: this.generateId(),
        description: '生成项目文件',
        status: 'in_progress',
        type: 'coding',
      });
      task.currentStep = 1;
      this.updateProgress(task);

      const files = await this.generateFiles(description, plan);
      task.steps[1].status = 'completed';
      task.steps[1].result = `生成了 ${files.length} 个文件`;
      task.generatedFiles = files;

      // Step 3: Write to disk
      task.steps.push({
        id: this.generateId(),
        description: '写入文件到磁盘',
        status: 'in_progress',
        type: 'deployment',
      });
      task.currentStep = 2;
      this.updateProgress(task);

      await this.writeFiles(files, workspacePath);
      task.steps[2].status = 'completed';

      task.status = 'completed';
      this.updateProgress(task);

      return task;
    } catch (error) {
      task.status = 'failed';
      if (task.steps[task.currentStep]) {
        task.steps[task.currentStep].status = 'failed';
        task.steps[task.currentStep].result = String(error);
      }
      this.updateProgress(task);
      throw error;
    }
  }

  // 编辑现有代码
  public async editCode(
    instruction: string,
    filePath: string,
    currentContent: string,
    config: AIProviderConfig
  ): Promise<CodeEdit[]> {
    this.setConfig(config);
    
    const client = this.getClient();
    const model = this.getModel();

    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `你是一个专业的代码编辑助手。请根据用户的指令，对提供的代码进行编辑。

请返回以下 JSON 格式的编辑操作列表：
{
  "edits": [
    {
      "filePath": "文件路径",
      "searchCode": "要搜索的代码片段（必须完全匹配）",
      "replaceCode": "替换后的代码",
      "explanation": "修改说明"
    }
  ]
}

注意：
1. searchCode 必须完全匹配原代码中的内容
2. 如果需要在特定位置插入代码，searchCode 可以是该位置前后的代码
3. 如果创建新文件，searchCode 为空字符串
4. 返回有效的 JSON 格式`,
        },
        {
          role: 'user',
          content: `指令：${instruction}\n\n文件路径：${filePath}\n\n当前代码：\n\`\`\`\n${currentContent}\n\`\`\``,
        },
      ],
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content || '';
    return this.parseCodeEdits(content);
  }

  // 智能代码补全
  public async completeCode(
    context: string,
    cursorPosition: { line: number; column: number },
    filePath: string,
    config: AIProviderConfig
  ): Promise<string> {
    this.setConfig(config);
    
    const client = this.getClient();
    const model = this.getModel();

    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: '你是一个代码补全助手。请根据上下文，在光标位置提供合适的代码补全。只返回补全的代码，不要包含任何解释。',
        },
        {
          role: 'user',
          content: `文件：${filePath}\n光标位置：第 ${cursorPosition.line} 行，第 ${cursorPosition.column} 列\n\n上下文代码：\n\`\`\`\n${context}\n\`\`\`\n\n请提供光标位置的代码补全：`,
        },
      ],
      temperature: 0.2,
      max_tokens: 500,
    });

    return response.choices[0]?.message?.content || '';
  }

  // 解释代码
  public async explainCode(
    code: string,
    filePath: string,
    config: AIProviderConfig
  ): Promise<string> {
    this.setConfig(config);
    
    const client = this.getClient();
    const model = this.getModel();

    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: '你是一个代码解释助手。请详细解释代码的功能、逻辑和关键部分。使用中文回复。',
        },
        {
          role: 'user',
          content: `文件：${filePath}\n\n代码：\n\`\`\`\n${code}\n\`\`\`\n\n请解释这段代码：`,
        },
      ],
      temperature: 0.5,
    });

    return response.choices[0]?.message?.content || '';
  }

  // 审查代码
  public async reviewCode(
    code: string,
    filePath: string,
    config: AIProviderConfig
  ): Promise<string> {
    this.setConfig(config);
    
    const client = this.getClient();
    const model = this.getModel();

    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `你是一个资深代码审查员。请审查代码并提供以下方面的反馈：
1. 潜在的 bug 和错误
2. 性能问题
3. 安全漏洞
4. 代码风格和最佳实践
5. 可维护性问题

请提供建设性的反馈和具体的改进建议。使用中文回复。`,
        },
        {
          role: 'user',
          content: `文件：${filePath}\n\n代码：\n\`\`\`\n${code}\n\`\`\`\n\n请审查这段代码：`,
        },
      ],
      temperature: 0.5,
    });

    return response.choices[0]?.message?.content || '';
  }

  // 流式代码生成
  public async *streamGenerate(
    description: string,
    config: AIProviderConfig
  ): AsyncGenerator<string> {
    this.setConfig(config);
    
    const client = this.getClient();
    const model = this.getModel();

    const stream = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `你是一个专业的全栈开发工程师。请根据用户的需求生成代码。

请使用 markdown 代码块格式返回代码，例如：
\`\`\`typescript
// 代码内容
\`\`\`

如果生成多个文件，请明确标注每个文件的路径。`,
        },
        {
          role: 'user',
          content: description,
        },
      ],
      temperature: 0.7,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  }

  private async analyzeRequirements(description: string): Promise<string> {
    const client = this.getClient();
    const model = this.getModel();

    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `你是一个专业的软件架构师。请分析用户的需求，并提供详细的项目规划。

请包含：
1. 项目类型和技术栈
2. 核心功能模块
3. 推荐的文件结构
4. 关键实现思路

使用中文回复。`,
        },
        {
          role: 'user',
          content: description,
        },
      ],
      temperature: 0.7,
    });

    return response.choices[0]?.message?.content || '';
  }

  private async generateFiles(description: string, plan: string): Promise<GeneratedFile[]> {
    const client = this.getClient();
    const model = this.getModel();

    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `你是一个专业的全栈开发工程师。请根据用户需求和项目规划，生成完整的项目代码。

请严格按照以下 JSON 格式返回：
{
  "files": [
    {
      "path": "相对于项目根目录的文件路径",
      "content": "文件完整内容",
      "language": "编程语言"
    }
  ]
}

注意：
1. 必须返回有效的 JSON
2. 文件路径使用正斜杠 /
3. 代码要完整且可运行
4. 包含所有必要的配置文件
5. 添加适当的注释`,
        },
        {
          role: 'user',
          content: `需求：${description}\n\n规划：${plan}`,
        },
      ],
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content || '';
    return this.parseGeneratedFiles(content);
  }

  private parseGeneratedFiles(content: string): GeneratedFile[] {
    let jsonStr = '';
    
    const codeBlockMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1];
    } else {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }
    }
    
    if (!jsonStr) {
      throw new Error('无法解析生成的文件结构，请确保返回有效的 JSON 格式');
    }

    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.files && Array.isArray(parsed.files)) {
        return parsed.files as GeneratedFile[];
      }
      if (Array.isArray(parsed)) {
        return parsed as GeneratedFile[];
      }
      throw new Error('生成的文件结构格式不正确');
    } catch (error) {
      console.error('解析内容:', jsonStr.substring(0, 200));
      throw new Error(`解析生成的文件失败: ${error}`);
    }
  }

  private parseCodeEdits(content: string): CodeEdit[] {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return [];
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (!parsed.edits || !Array.isArray(parsed.edits)) {
        return [];
      }
      return parsed.edits as CodeEdit[];
    } catch (error) {
      console.error('解析代码编辑失败:', error);
      return [];
    }
  }

  private async writeFiles(files: GeneratedFile[], workspacePath: string): Promise<void> {
    for (const file of files) {
      const filePath = path.join(workspacePath, file.path);
      const dir = path.dirname(filePath);
      
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(filePath, file.content, 'utf-8');
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  public getCurrentTask(): BuilderTask | null {
    return this.currentTask;
  }

  public cancelCurrentTask(): void {
    if (this.currentTask && this.currentTask.status === 'in_progress') {
      this.currentTask.status = 'failed';
      if (this.currentTask.steps[this.currentTask.currentStep]) {
        this.currentTask.steps[this.currentTask.currentStep].status = 'failed';
        this.currentTask.steps[this.currentTask.currentStep].result = '用户取消';
      }
      this.updateProgress(this.currentTask);
    }
  }
}
