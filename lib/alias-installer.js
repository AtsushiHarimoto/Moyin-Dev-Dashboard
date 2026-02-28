const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

/**
 * Shell Alias 安装器
 */
class AliasInstaller {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.cliPath = path.join(projectRoot, 'tools', 'skills-switch', 'cli.js');
    this.platform = process.platform;
  }

  /**
   * 检测当前 shell
   */
  detectShell() {
    if (this.platform === 'win32') {
      return process.env.PSModulePath ? 'powershell' : 'cmd';
    }

    const shell = process.env.SHELL || '/bin/bash';
    return path.basename(shell);
  }

  /**
   * 获取 shell 配置文件路径
   */
  getShellConfigPath(shell) {
    const home = os.homedir();

    const configs = {
      bash: [
        path.join(home, '.bashrc'),
        path.join(home, '.bash_profile'),
        path.join(home, '.profile')
      ],
      zsh: [path.join(home, '.zshrc')],
      fish: [path.join(home, '.config', 'fish', 'config.fish')],
      powershell: [
        path.join(home, 'Documents', 'PowerShell', 'Microsoft.PowerShell_profile.ps1'),
        path.join(home, 'Documents', 'WindowsPowerShell', 'Microsoft.PowerShell_profile.ps1')
      ]
    };

    const paths = configs[shell] || configs.bash;

    // 返回第一个存在的文件，或者默认文件
    for (const p of paths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }

    return paths[0];
  }

  /**
   * 生成 alias 内容
   */
  generateAliasContent(shell, aliasName = 'ss') {
    const cliPath = this.cliPath;

    if (shell === 'powershell') {
      return `
# Skills Switch - Added by skills-switch init
function ${aliasName} {
  node "${cliPath}" @args
}
$env:SKILLS_SWITCH_HOME = "${path.dirname(cliPath)}"
`;
    } else if (shell === 'fish') {
      return `
# Skills Switch - Added by skills-switch init
alias ${aliasName}="node ${cliPath}"
set -x SKILLS_SWITCH_HOME "${path.dirname(cliPath)}"
`;
    } else {
      // bash, zsh
      return `
# Skills Switch - Added by skills-switch init
alias ${aliasName}="node ${cliPath}"
export SKILLS_SWITCH_HOME="${path.dirname(cliPath)}"
`;
    }
  }

  /**
   * 检查 alias 是否已安装
   */
  async isInstalled(aliasName = 'ss') {
    const shell = this.detectShell();
    const configPath = this.getShellConfigPath(shell);

    if (!await fs.pathExists(configPath)) {
      return false;
    }

    const content = await fs.readFile(configPath, 'utf-8');
    return content.includes(`alias ${aliasName}=`) || content.includes(`function ${aliasName}`);
  }

  /**
   * 安装 alias
   */
  async install(aliasName = 'ss') {
    const shell = this.detectShell();
    const configPath = this.getShellConfigPath(shell);

    // 确保配置文件存在
    await fs.ensureFile(configPath);

    // 检查是否已安装
    if (await this.isInstalled(aliasName)) {
      throw new Error(`Alias '${aliasName}' already installed in ${configPath}`);
    }

    // 备份配置文件
    await fs.copy(configPath, `${configPath}.backup`);

    // 添加 alias
    const aliasContent = this.generateAliasContent(shell, aliasName);
    await fs.appendFile(configPath, aliasContent);

    return {
      shell,
      configPath,
      aliasName,
      backupPath: `${configPath}.backup`
    };
  }

  /**
   * 卸载 alias
   */
  async uninstall(aliasName = 'ss') {
    const shell = this.detectShell();
    const configPath = this.getShellConfigPath(shell);

    if (!await fs.pathExists(configPath)) {
      return false;
    }

    // 读取配置文件
    let content = await fs.readFile(configPath, 'utf-8');

    // 删除 Skills Switch 相关的行
    const lines = content.split('\n');
    const filteredLines = [];
    let inSkillsSwitch = false;

    for (const line of lines) {
      if (line.includes('# Skills Switch - Added by')) {
        inSkillsSwitch = true;
        continue;
      }

      if (inSkillsSwitch) {
        // 只跳過明確屬於 skills-switch 的行：精確匹配 alias 定義、function 定義、環境變數
        if (
          line.trim() === '' ||
          line.includes('SKILLS_SWITCH_HOME') ||
          new RegExp(`^\\s*alias\\s+${aliasName}=`).test(line) ||
          new RegExp(`^\\s*function\\s+${aliasName}\\s`).test(line) ||
          new RegExp(`^\\s*\\$env:SKILLS_SWITCH_HOME`).test(line)
        ) {
          continue;
        } else {
          inSkillsSwitch = false;
        }
      }

      filteredLines.push(line);
    }

    // 写回文件
    await fs.writeFile(configPath, filteredLines.join('\n'));

    return true;
  }

  /**
   * 获取 alias 状态
   */
  async getStatus(aliasName = 'ss') {
    const shell = this.detectShell();
    const configPath = this.getShellConfigPath(shell);
    const installed = await this.isInstalled(aliasName);

    return {
      shell,
      configPath,
      aliasName,
      installed,
      cliPath: this.cliPath
    };
  }

  /**
   * 测试 alias 是否工作
   */
  async test(aliasName = 'ss') {
    try {
      // 驗證 alias 名稱，防止指令注入
      if (!/^[a-zA-Z0-9_-]+$/.test(aliasName)) {
        return { success: false, error: 'Invalid alias name' };
      }
      // 注意：这个测试在当前 shell 中可能不工作
      // 因为需要重新加载 shell 配置
      const { stdout } = await execAsync(`${aliasName} --version`);
      return { success: true, output: stdout };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

module.exports = AliasInstaller;
