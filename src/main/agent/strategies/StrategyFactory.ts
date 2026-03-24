/**
 * 策略工厂
 * 管理 Agent 策略的创建和选择
 */

import type { AgentStrategy, StrategyType } from './AgentStrategy';
import { ChatStrategy } from './ChatStrategy';
import { BuilderStrategy } from './BuilderStrategy';
import { SoloStrategy } from './SoloStrategy';

export class StrategyFactory {
  private static strategies: Map<StrategyType, new () => AgentStrategy> = new Map();

  static initialize(): void {
    this.register('chat', ChatStrategy);
    this.register('builder', BuilderStrategy);
    this.register('solo', SoloStrategy);
  }

  static register(type: StrategyType, strategyClass: new () => AgentStrategy): void {
    this.strategies.set(type, strategyClass);
  }

  static create(type: StrategyType): AgentStrategy {
    if (!this.strategies.has(type)) {
      throw new Error(`Unknown strategy type: ${type}. Available types: ${Array.from(this.strategies.keys()).join(', ')}`);
    }

    const StrategyClass = this.strategies.get(type)!;
    return new StrategyClass();
  }

  static getAvailableStrategies(): Array<{ type: StrategyType; name: string; description: string }> {
    const strategies: Array<{ type: StrategyType; name: string; description: string }> = [];

    for (const [type, StrategyClass] of this.strategies.entries()) {
      const instance = new StrategyClass();
      strategies.push({
        type,
        name: instance.name,
        description: instance.description,
      });
    }

    return strategies;
  }

  static getStrategyInfo(type: StrategyType): { name: string; description: string; type: StrategyType } | null {
    try {
      const strategy = this.create(type);
      return {
        type: strategy.type,
        name: strategy.name,
        description: strategy.description,
      };
    } catch (error) {
      return null;
    }
  }

  static isValidType(type: string): type is StrategyType {
    return this.strategies.has(type as StrategyType);
  }

  static getDefaultStrategy(): AgentStrategy {
    return this.create('chat');
  }

  static getStrategyByTaskType(taskType: string): AgentStrategy {
    switch (taskType) {
      case 'chat':
        return this.create('chat');
      case 'builder':
        return this.create('builder');
      case 'solocoder':
        return this.create('solo');
      default:
        return this.getDefaultStrategy();
    }
  }
}

StrategyFactory.initialize();

export const createStrategy = (type: StrategyType): AgentStrategy => {
  return StrategyFactory.create(type);
};

export const getAvailableStrategies = (): Array<{ type: StrategyType; name: string; description: string }> => {
  return StrategyFactory.getAvailableStrategies();
};
