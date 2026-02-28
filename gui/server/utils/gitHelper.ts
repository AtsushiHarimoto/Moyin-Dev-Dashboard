import { exec } from 'child_process';
import { promisify } from 'util';

/**
 * Git 命令執行助手
 * 提供異步執行 git 命令的功能
 */
export const execAsync = promisify(exec);
