#!/usr/bin/env node

const { program } = require('commander');
const path = require('path');
const fs = require('fs-extra');
const SkillsSwitch = require('./lib/main');
const AliasInstaller = require('./lib/alias-installer');
const UI = require('./lib/ui');

// 查找项目根目录
function findProjectRoot() {
  let dir = __dirname;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.git'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return process.cwd();
}

const projectRoot = findProjectRoot();
const ui = new UI();

// 创建主实例
const ss = new SkillsSwitch({ projectRoot });

// CLI 配置
program
  .name('skills-switch')
  .description('Smart skills profile switcher for Codex, Claude Code and Antigravity')
  .version(require('./package.json').version)
  .alias('ss');

// init 命令
program
  .command('init')
  .description('Initialize skills-switch configuration')
  .action(async () => {
    try {
      await ss.init();
    } catch (err) {
      ui.error(err.message);
      process.exit(1);
    }
  });

// use 命令
program
  .command('use <profile>')
  .description('Switch to a profile')
  .option('-t, --tool <tool>', 'Only switch specific tool (cx, cc, anti)')
  .option('--all', 'Switch all tools with same mode')
  .action(async (profile, options) => {
    try {
      if (options.all) {
        // 提取模式（如 review, backend-dev）
        const mode = profile.includes('-') ? profile.split('-').slice(1).join('-') : profile;

        ui.info(`Switching all tools to ${mode} mode...`);

        // 依次切换所有工具
        for (const tool of ['cx', 'cc', 'anti']) {
          const profileName = `${tool}-${mode}`;
          try {
            await ss.use(profileName);
          } catch (err) {
            ui.warning(`Skipped ${profileName}: ${err.message}`);
          }
        }
      } else {
        await ss.use(profile, options);
      }
    } catch (err) {
      ui.error(err.message);
      process.exit(1);
    }
  });

// status 命令
program
  .command('status')
  .description('Show current status')
  .alias('current')
  .action(async () => {
    try {
      await ss.status();
    } catch (err) {
      ui.error(err.message);
      process.exit(1);
    }
  });

// list 命令
program
  .command('list')
  .description('List all available profiles')
  .alias('ls')
  .action(async () => {
    try {
      await ss.list();
    } catch (err) {
      ui.error(err.message);
      process.exit(1);
    }
  });

// diff 命令
program
  .command('diff [profile]')
  .description('Show differences between current and profile')
  .action(async (profile) => {
    try {
      if (!profile) {
        ui.error('Please specify a profile name');
        process.exit(1);
      }
      await ss.diff(profile);
    } catch (err) {
      ui.error(err.message);
      process.exit(1);
    }
  });

// backup 命令
program
  .command('backup')
  .description('Manually backup current configuration')
  .option('-t, --tool <tool>', 'Only backup specific tool (cx, cc, anti)')
  .action(async (options) => {
    try {
      const results = await ss.backup(options.tool);
      ui.success('Backup completed!');
      results.forEach(r => {
        console.log(`  ${r.tool}: ${r.path}`);
      });
    } catch (err) {
      ui.error(err.message);
      process.exit(1);
    }
  });

// restore 命令
program
  .command('restore [backup-id]')
  .description('Restore from backup')
  .option('-t, --tool <tool>', 'Only restore specific tool (cx, cc, anti)')
  .action(async (backupId, options) => {
    try {
      await ss.restore(backupId, options.tool);
      ui.success('Restore completed!');
    } catch (err) {
      ui.error(err.message);
      process.exit(1);
    }
  });

// rollback 命令
program
  .command('rollback')
  .description('Rollback to previous profile')
  .option('-t, --tool <tool>', 'Only rollback specific tool (cx, cc, anti)')
  .action(async (options) => {
    try {
      const result = await ss.rollback(options.tool);
      ui.success(`Rolled back to: ${result.profile}`);
    } catch (err) {
      ui.error(err.message);
      process.exit(1);
    }
  });

// add 命令
program
  .command('add <skill> [profile]')
  .description('Add a skill to a profile')
  .action(async (skill, profile) => {
    try {
      const result = await ss.addSkill(skill, profile);
      ui.success(`Added '${skill}' to ${result.profile}`);
    } catch (err) {
      ui.error(err.message);
      process.exit(1);
    }
  });

// remove 命令
program
  .command('remove <skill> [profile]')
  .description('Remove a skill from a profile')
  .action(async (skill, profile) => {
    try {
      const result = await ss.removeSkill(skill, profile);
      ui.success(`Removed '${skill}' from ${result.profile}`);
    } catch (err) {
      ui.error(err.message);
      process.exit(1);
    }
  });

// sync 命令
program
  .command('sync [profile]')
  .description('Sync current skills to profile')
  .option('--force', 'Force sync without confirmation')
  .action(async (profile, options) => {
    try {
      const result = await ss.sync(profile, options);
      ui.success(`Synced ${result.count} skills to ${result.profile}`);
    } catch (err) {
      ui.error(err.message);
      process.exit(1);
    }
  });

// env-sync 命令
program
  .command('env-sync')
  .description('Sync skills between project and global environment (cross-platform)')
  .option('-t, --tool <tool>', 'Specific tool to sync (cc, cx, anti)')
  .option('-r, --reverse', 'Reverse sync: global → project (.agent/skills-all/)')
  .action(async (options) => {
    try {
      const results = await ss.envSync(options.tool, { reverse: !!options.reverse });
      ui.success('Environment synchronization completed!');
      const direction = options.reverse ? 'global to project' : 'project to global';
      results.forEach(r => {
        if (r.synced > 0) {
          console.log(`  ${r.tool}: Synced ${r.synced} skills from ${direction}.`);
        } else {
          console.log(`  ${r.tool}: Already up to date.`);
        }
      });
    } catch (err) {
      ui.error(err.message);
      process.exit(1);
    }
  });

// common 命令组
const common = program
  .command('common')
  .description('Manage common skills (always loaded)');

common
  .command('list')
  .alias('ls')
  .description('List common skills')
  .action(async () => {
    try {
      const commonSkills = await ss.loadCommonSkills();
      console.log('\n📌 Common Skills (always loaded):\n');

      console.log('  All tools:');
      if (commonSkills.all?.length > 0) {
        commonSkills.all.forEach(s => console.log(`    • ${s}`));
      } else {
        console.log('    (none)');
      }

      console.log('\n  Codex (cx):');
      if (commonSkills.cx?.length > 0) {
        commonSkills.cx.forEach(s => console.log(`    • ${s}`));
      } else {
        console.log('    (none)');
      }

      console.log('\n  Claude Code (cc):');
      if (commonSkills.cc?.length > 0) {
        commonSkills.cc.forEach(s => console.log(`    • ${s}`));
      } else {
        console.log('    (none)');
      }

      console.log('\n  Antigravity (anti):');
      if (commonSkills.anti?.length > 0) {
        commonSkills.anti.forEach(s => console.log(`    • ${s}`));
      } else {
        console.log('    (none)');
      }

      // 顯示釘選 plugins
      const commonPath = require('path').join(ss.profilesDir, 'common.json');
      try {
        const commonJson = require(commonPath);
        const plugins = commonJson.plugins || {};
        const hasPlugins = Object.values(plugins).some(arr => arr?.length > 0);
        if (hasPlugins) {
          const currentPlatform = process.platform;
          console.log('\n📎 Pinned Plugins (always kept):');
          for (const [tool, list] of Object.entries(plugins)) {
            if (!list?.length) continue;
            const label = { cc: 'Claude Code', cx: 'Codex', anti: 'Antigravity' }[tool] || tool;
            console.log(`\n  ${label} (${tool}):`);
            list.forEach(p => {
              const id = typeof p === 'string' ? p : p.id;
              const plat = typeof p === 'object' && p.platform ? p.platform : 'all';
              const active = plat === 'all' || plat === currentPlatform;
              const platLabel = plat === 'all' ? '' : ` [${plat}]`;
              console.log(`    • ${id}${platLabel}${active ? '' : ' (skipped on this platform)'}`);
            });
          }
        }
      } catch { /* common.json may not have plugins */ }

      console.log('\n💡 Edit profiles/common.json to modify');
    } catch (err) {
      ui.error(err.message);
      process.exit(1);
    }
  });

common
  .command('add <skill>')
  .description('Add a skill to common (all tools)')
  .option('-t, --tool <tool>', 'Only add for specific tool (cx, cc, anti)')
  .action(async (skill, options) => {
    try {
      await ss.addCommonSkill(skill, options.tool);
      const target = options.tool || 'all';
      ui.success(`Added '${skill}' to common skills (${target})`);
    } catch (err) {
      ui.error(err.message);
      process.exit(1);
    }
  });

common
  .command('remove <skill>')
  .description('Remove a skill from common')
  .option('-t, --tool <tool>', 'Only remove from specific tool (cx, cc, anti)')
  .action(async (skill, options) => {
    try {
      await ss.removeCommonSkill(skill, options.tool);
      const target = options.tool || 'all';
      ui.success(`Removed '${skill}' from common skills (${target})`);
    } catch (err) {
      ui.error(err.message);
      process.exit(1);
    }
  });

// alias 命令组
const alias = program
  .command('alias')
  .description('Manage shell alias');

alias
  .command('install')
  .description('Install shell alias')
  .option('-n, --name <name>', 'Alias name', 'ss')
  .action(async (options) => {
    try {
      const installer = new AliasInstaller(projectRoot);
      const result = await installer.install(options.name);

      ui.success(`Alias '${result.aliasName}' installed to ${result.configPath}`);
      ui.info(`\n🔄 To apply changes:`);
      console.log(`  source ${result.configPath}`);
      console.log('  # Or restart your terminal\n');
    } catch (err) {
      ui.error(err.message);
      process.exit(1);
    }
  });

alias
  .command('uninstall')
  .description('Uninstall shell alias')
  .option('-n, --name <name>', 'Alias name', 'ss')
  .action(async (options) => {
    try {
      const installer = new AliasInstaller(projectRoot);
      await installer.uninstall(options.name);

      ui.success(`Alias '${options.name}' uninstalled`);
    } catch (err) {
      ui.error(err.message);
      process.exit(1);
    }
  });

alias
  .command('status')
  .description('Check alias status')
  .option('-n, --name <name>', 'Alias name', 'ss')
  .action(async (options) => {
    try {
      const installer = new AliasInstaller(projectRoot);
      const status = await installer.getStatus(options.name);

      console.log('\n📊 Alias Status:');
      console.log(`  Name:     ${status.aliasName}`);
      console.log(`  Shell:    ${status.shell}`);
      console.log(`  Config:   ${status.configPath}`);
      console.log(`  Status:   ${status.installed ? ui.colors.success('✓ Active') : ui.colors.error('✗ Not installed')}`);
      console.log(`  Location: ${status.cliPath}\n`);
    } catch (err) {
      ui.error(err.message);
      process.exit(1);
    }
  });

// plugins 命令组（仅 Claude Code）
const plugins = program
  .command('plugins')
  .description('Manage Claude Code plugins');

plugins
  .command('list')
  .description('List all installed plugins')
  .alias('ls')
  .action(async () => {
    try {
      const pluginDetails = await ss.claude.getPluginDetails();
      ui.showPluginStatus(pluginDetails);
    } catch (err) {
      ui.error(err.message);
      process.exit(1);
    }
  });

plugins
  .command('restore')
  .description('Restore all plugins')
  .action(async () => {
    try {
      const count = await ss.claude.restoreAllPlugins();
      ui.success(`Restored ${count} plugins`);
      ui.info('Restart Claude Code to apply changes');
    } catch (err) {
      ui.error(err.message);
      process.exit(1);
    }
  });

// 默认显示帮助
if (process.argv.length === 2) {
  ui.showBanner();
  ui.showQuickHelp();
  program.help();
}

// 解析命令
program.parse(process.argv);
