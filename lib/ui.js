const chalk = require('chalk');
const boxen = require('boxen');
const Table = require('cli-table3');
const ora = require('ora');
const pkg = require('../package.json');
const { TOOL_NAME_MAP } = require('./constants');

class UI {
  constructor() {
    this.colors = {
      codex: chalk.blue,
      claude: chalk.green,
      anti: chalk.magenta,
      success: chalk.green,
      error: chalk.red,
      warning: chalk.yellow,
      info: chalk.cyan,
      dim: chalk.gray
    };
  }

  /**
   * 显示启动 Banner
   */
  showBanner() {
    const banner = `
    ███████╗██╗  ██╗██╗██╗     ██╗     ███████╗
    ██╔════╝██║ ██╔╝██║██║     ██║     ██╔════╝
    ███████╗█████╔╝ ██║██║     ██║     ███████╗
    ╚════██║██╔═██╗ ██║██║     ██║     ╚════██║
    ███████║██║  ██╗██║███████╗███████╗███████║
    ╚══════╝╚═╝  ╚═╝╚═╝╚══════╝╚══════╝╚══════╝

           💫 Skills Profile Switcher v${pkg.version}
        Manage skills for Codex • Claude • Anti
    `;

    console.log(
      boxen(chalk.cyan(banner), {
        padding: 1,
        margin: 1,
        borderStyle: 'double',
        borderColor: 'cyan'
      })
    );
  }

  /**
   * 显示快速命令帮助
   */
  showQuickHelp() {
    console.log(chalk.bold('\n⚡ Quick Commands:'));
    console.log('  ss use <profile>     Switch to a profile');
    console.log('  ss list              List all profiles');
    console.log('  ss status            Show current status');
    console.log('  ss --help            Show all commands\n');
  }

  /**
   * 显示状态表格
   */
  showStatus(state) {
    const table = new Table({
      head: ['Tool', 'Active Profile', 'Skills', 'Savings'],
      style: {
        head: ['cyan'],
        border: ['gray']
      }
    });

    const tools = [
      { name: 'Codex', icon: '🔵', key: 'codex', total: state.totals?.codex || 0 },
      { name: 'Claude', icon: '🟢', key: 'claude', total: state.totals?.claude || 0 },
      { name: 'Anti', icon: '🟣', key: 'anti', total: state.totals?.anti || 0 }
    ];

    tools.forEach(tool => {
      const current = state.current?.[tool.key] || 'none';
      const count = state.counts?.[tool.key] || 0;
      const total = tool.total;
      const savings = total - count;
      const savingsText = savings > 0 ? `~${(savings * 70 / 1000).toFixed(1)}k` : '0';

      table.push([
        `${tool.icon} ${tool.name}`,
        current,
        `${count}/${total}`,
        savingsText
      ]);
    });

    console.log('\n' + table.toString());

    // 总节省
    const totalSavings = Object.values(state.counts || {}).reduce((sum, count, i) => {
      const total = Object.values(state.totals || {})[i] || 0;
      return sum + (total - count);
    }, 0);

    if (totalSavings > 0) {
      console.log(chalk.green(`\n💡 Total Token Savings: ~${(totalSavings * 70 / 1000).toFixed(1)}k tokens per session`));
    }

    // 最后切换时间
    if (state.lastSwitch) {
      console.log(chalk.dim(`\n⏰ Last Switch: ${new Date(state.lastSwitch).toLocaleString()}`));
    }
  }

  /**
   * 显示 Profile 列表
   */
  showProfiles(profiles, currentState) {
    console.log(
      boxen(chalk.bold('📚 Available Profiles'), {
        padding: { left: 2, right: 2, top: 0, bottom: 0 },
        borderColor: 'cyan',
        borderStyle: 'round'
      })
    );

    const groupedByTool = {
      cx: [],
      cc: [],
      anti: []
    };

    profiles.forEach(profile => {
      const rawTool = profile.tool || profile.name.split('-')[0];
      const tool = TOOL_NAME_MAP[rawTool] || rawTool;
      if (groupedByTool[tool]) {
        groupedByTool[tool].push(profile);
      }
    });

    // Codex
    console.log('\n' + this.colors.codex('🔵 Codex (cx)'));
    groupedByTool.cx.forEach(p => {
      const active = (currentState?.current?.codex === p.name || currentState?.current?.cx === p.name) ? chalk.yellow(' ★') : '';
      const heavy = p.skills?.length > 100 ? chalk.red(' ⚠️') : '';
      console.log(`  ├─ ${p.name.padEnd(20)} → ${p.description} (${p.skills?.length || 0} skills)${active}${heavy}`);
    });

    // Claude
    console.log('\n' + this.colors.claude('🟢 Claude Code (cc)'));
    groupedByTool.cc.forEach(p => {
      const active = (currentState?.current?.claude === p.name || currentState?.current?.cc === p.name) ? chalk.yellow(' ★') : '';
      const heavy = p.skills?.length > 100 ? chalk.red(' ⚠️') : '';
      console.log(`  ├─ ${p.name.padEnd(20)} → ${p.description} (${p.skills?.length || 0} skills)${active}${heavy}`);
    });

    // Anti
    console.log('\n' + this.colors.anti('🟣 Antigravity (anti)'));
    groupedByTool.anti.forEach(p => {
      const active = currentState?.current?.anti === p.name ? chalk.yellow(' ★') : '';
      const heavy = p.skills?.length > 50 ? chalk.red(' ⚠️') : '';
      console.log(`  ├─ ${p.name.padEnd(20)} → ${p.description} (${p.skills?.length || 0} skills)${active}${heavy}`);
    });

    console.log(chalk.dim('\nLegend: ★ Currently Active  ⚠️  Heavy (may use many tokens)'));
  }

  /**
   * 创建加载动画
   */
  createSpinner(text) {
    return ora({
      text,
      spinner: 'dots',
      color: 'cyan'
    });
  }

  /**
   * 显示成功消息
   */
  success(message) {
    console.log(this.colors.success('✓ ') + message);
  }

  /**
   * 显示错误消息
   */
  error(message) {
    console.log(this.colors.error('✗ ') + message);
  }

  /**
   * 显示警告消息
   */
  warning(message) {
    console.log(this.colors.warning('⚠ ') + message);
  }

  /**
   * 显示信息消息
   */
  info(message) {
    console.log(this.colors.info('ℹ ') + message);
  }

  /**
   * 显示分组标题
   */
  section(title) {
    console.log('\n' + chalk.bold.cyan(`[${title}]`));
  }

  /**
   * 显示切换成功的详细信息
   */
  showSwitchSuccess(profile, changes) {
    console.log(
      boxen(
        this.colors.success('✅ Successfully switched to ' + profile.name),
        {
          padding: { left: 2, right: 2, top: 0, bottom: 0 },
          borderColor: 'green',
          borderStyle: 'round',
          margin: { top: 1, bottom: 1 }
        }
      )
    );

    console.log(chalk.bold('📊 Changes:'));
    console.log(`  • Skills: ${changes.before} → ${changes.after} (${chalk.yellow(changes.diff)})`);

    // 显示共通 skills（如果有）
    if (changes.commonSkills > 0) {
      console.log(`  • Common skills: ${chalk.blue(changes.commonSkills)} (always loaded)`);
    }

    // 显示 plugins 变更（如果有）
    if (changes.plugins) {
      const { enabled, disabled, skipped, pinned } = changes.plugins;
      console.log(`  • Plugins: ${enabled?.length || 0} enabled, ${disabled?.length || 0} disabled`);
      if (enabled?.length > 0) {
        console.log(chalk.dim(`    ├─ Enabled: ${enabled.map(p => p.split('@')[0]).join(', ')}`));
      }
      if (pinned?.length > 0) {
        console.log(chalk.dim(`    ├─ Pinned (always kept): ${pinned.map(p => p.split('@')[0]).join(', ')}`));
      }
      if (disabled?.length > 0) {
        console.log(chalk.dim(`    └─ Disabled: ${disabled.map(p => p.split('@')[0]).join(', ')}`));
      }
    }

    console.log(`  • Token savings: ${chalk.green('~' + changes.savings + ' tokens')} per session`);
    console.log(`  • Profile: ${chalk.cyan(profile.name)} (${profile.description})`);

    // 显示缺失技能提醒
    if (changes.skipped && changes.skipped.length > 0) {
      console.log('\n' + this.colors.warning('⚠️  Detection: ' + changes.skipped.length + ' skills are missing in local environment:'));
      console.log(chalk.dim('    ' + changes.skipped.join(', ')));
      console.log(chalk.yellow(`    Run '/repair-claude-skills' to fix missing installations.`));
    }

    console.log(chalk.bold('\n🚀 Next Steps:'));
    console.log('  1. Restart tool to apply changes');
    console.log(`  2. Run '${profile.tool}' to start with new profile`);
    console.log(chalk.dim(`\n💡 Tip: Use 'ss rollback' to undo this change`));
  }

  /**
   * 显示 Plugin 状态
   */
  showPluginStatus(plugins) {
    console.log(
      boxen(chalk.bold('🔌 Installed Plugins'), {
        padding: { left: 2, right: 2, top: 0, bottom: 0 },
        borderColor: 'cyan',
        borderStyle: 'round'
      })
    );

    const table = new Table({
      head: ['Plugin', 'Status', 'Scope', 'Version'],
      style: {
        head: ['cyan'],
        border: ['gray']
      }
    });

    plugins.forEach(p => {
      const name = p.name.split('@')[0];
      const status = p.enabled ? chalk.green('✓ Enabled') : chalk.gray('○ Disabled');
      const scope = p.scope === 'user' ? chalk.blue('User') : chalk.yellow('Project');
      table.push([name, status, scope, p.version]);
    });

    console.log('\n' + table.toString());
  }

  /**
   * 显示平台差异
   */
  showPlatformDiff(diff) {
    console.log(
      boxen(chalk.bold('🌍 Cross-Platform Skills Comparison'), {
        padding: { left: 2, right: 2, top: 0, bottom: 0 },
        borderColor: 'cyan',
        borderStyle: 'round'
      })
    );

    console.log(`\n📊 Comparing: ${diff.platforms.join(' ↔ ')}`);
    console.log(chalk.dim(`  Last sync: ${diff.lastSync || 'Never'}`));

    Object.entries(diff.tools).forEach(([tool, data]) => {
      const color = this.colors[tool] || chalk.white;
      console.log('\n' + color(`${'🔵🟢🟣'[['codex', 'claude', 'anti'].indexOf(tool)]} ${tool.toUpperCase()} Skills`));
      console.log(`  ✓ Both platforms:     ${data.both || 0} skills`);
      console.log(`  📱 Mac only:          ${data.macOnly || 0} skills`);
      console.log(`  🪟 Windows only:      ${data.winOnly || 0} skills`);
      if (data.versionDiff) {
        console.log(`  ⚠️  Version diff:      ${data.versionDiff} skills`);
      }
    });
  }
}

module.exports = UI;
