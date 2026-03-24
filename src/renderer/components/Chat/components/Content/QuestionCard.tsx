/**
 * QuestionCard 组件
 * 问题选择卡片的展示
 */

import React from 'react';
import { HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { AgentQuestion } from '@shared/agentTypes';

interface QuestionCardProps {
  question: AgentQuestion;
  onAnswer?: (value: string) => void;
  className?: string;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  onAnswer,
  className = '',
}) => {
  const { question: questionText, options, status } = question;
  const isAnswered = status === 'answered';

  return (
    <div
      className={cn(
        'rounded-lg border overflow-hidden shadow-sm transition-all',
        isAnswered
          ? 'border-green-200 bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-900/20 dark:to-green-900/10 dark:border-green-800/20'
          : 'border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-900/10 dark:border-blue-800/20',
        className
      )}
    >
      <div className={cn(
        'flex items-center gap-2 px-4 py-3 border-b',
        isAnswered
          ? 'bg-green-100/50 dark:bg-green-900/20 border-green-200/50 dark:border-green-800/20'
          : 'bg-blue-100/50 dark:bg-blue-900/20 border-blue-200/50 dark:border-blue-800/20'
      )}>
        <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center">
          <HelpCircle className={cn(
            'w-4 h-4',
            isAnswered ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'
          )} />
        </div>
        <span className={cn(
          'text-xs font-semibold uppercase tracking-wide',
          isAnswered ? 'text-green-800 dark:text-green-200' : 'text-blue-800 dark:text-blue-200'
        )}>
          {isAnswered ? '✓ 已回答' : '需要您的选择'}
        </span>
      </div>

      <div className="px-4 py-4 space-y-4">
        {questionText && (
          <p className="text-sm font-medium text-foreground leading-relaxed">{questionText}</p>
        )}

        {options && options.length > 0 && !isAnswered && (
          <div className="space-y-2">
            {options.map((option) => (
              <Button
                key={option.id || option.value}
                variant="outline"
                className="w-full justify-start h-auto py-3 px-4 text-sm hover:bg-blue-50 hover:border-blue-300 dark:hover:bg-blue-900/20 transition-all"
                onClick={() => onAnswer?.(option.value)}
              >
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-blue-500/10 to-blue-500/20 flex items-center justify-center text-xs font-bold text-blue-600 dark:text-blue-400 mr-3">
                  {option.label.charAt(0).toUpperCase()}
                </span>
                {option.label}
              </Button>
            ))}
          </div>
        )}
        
        {isAnswered && question.answer && (
          <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800/20">
            <p className="text-xs font-medium text-green-800 dark:text-green-200 mb-1">您的回答：</p>
            <p className="text-sm text-green-700 dark:text-green-300">{question.answer}</p>
          </div>
        )}
      </div>
    </div>
  );
};
