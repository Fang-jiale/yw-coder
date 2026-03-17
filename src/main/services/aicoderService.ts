import { ipcMain, IpcMainEvent } from 'electron';
import { aiSkillService, CodeSelection } from './aiSkillService';
import { aiStreamService } from './aiStreamService';
import AIService from './aiService';
import { BUILTIN_COMMANDS, CodeEditOperation } from '../../shared/aiCommands';

/**
 * AICoder Service - IPC 处理器
 * 处理 AI 代码编辑相关的 IPC 调用
 */
export function setupAICoderService(aiService: AIService) {
  // 流式执行 AI 命令
  ipcMain.on(
    'aicoder:stream',
    (
      event: IpcMainEvent,
      {
        input,
        workspacePath,
        configId,
        openFilePaths,
        selection,
        history,
      }: {
        input: string;
        workspacePath: string;
        configId: string;
        openFilePaths?: string[];
        selection?: CodeSelection;
        history?: Array<{ role: 'user' | 'assistant'; content: string }>;
      }
    ) => {
      const config = aiService.getConfig(configId);
      if (!config) {
        event.reply('aicoder:stream:chunk', {
          type: 'error',
          error: `未找到 AI 配置: ${configId}`,
        });
        return;
      }

      aiStreamService.streamExecute(
        input,
        workspacePath,
        config,
        (chunk) => {
          event.reply('aicoder:stream:chunk', chunk);
        },
        {
          openFilePaths,
          selection: selection || undefined,
          history,
        }
      );
    }
  );

  // 应用代码编辑（保留用于兼容性）
  ipcMain.handle(
    'aicoder:applyEdit',
    async (
      _event,
      {
        edit,
        workspacePath,
      }: {
        edit: CodeEditOperation;
        workspacePath: string;
      }
    ) => {
      try {
        const result = await aiSkillService.applyCodeEdit(edit, workspacePath);
        return {
          success: result.success,
          data: result.data,
          error: result.error,
        };
      } catch (error) {
        console.error('AICoder applyEdit error:', error);
        return {
          success: false,
          error: String(error),
        };
      }
    }
  );

  // 获取可用命令列表
  ipcMain.handle('aicoder:getCommands', async () => {
    return BUILTIN_COMMANDS.map((cmd) => ({
      id: cmd.id,
      name: cmd.name,
      description: cmd.description,
      argumentHint: cmd.argumentHint,
      requiresSelection: cmd.requiresSelection,
      allowedTools: cmd.allowedTools,
    }));
  });

  // 读取文件内容
  ipcMain.handle(
    'aicoder:readFile',
    async (_event, { filePath, workspacePath }: { filePath: string; workspacePath: string }) => {
      try {
        const result = await aiSkillService.executeTool('Read', { filePath }, workspacePath);
        return {
          success: result.success,
          content: result.data?.content,
          error: result.error,
        };
      } catch (error) {
        return {
          success: false,
          error: String(error),
        };
      }
    }
  );

  // 搜索代码
  ipcMain.handle(
    'aicoder:grep',
    async (
      _event,
      {
        pattern,
        workspacePath,
        glob,
      }: { pattern: string; workspacePath: string; glob?: string }
    ) => {
      try {
        const result = await aiSkillService.executeTool(
          'Grep',
          { pattern, glob },
          workspacePath
        );
        return {
          success: result.success,
          results: result.data?.results,
          error: result.error,
        };
      } catch (error) {
        return {
          success: false,
          error: String(error),
        };
      }
    }
  );
}
